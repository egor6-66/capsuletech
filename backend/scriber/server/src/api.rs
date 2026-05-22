//! HTTP endpoints — handlers + request/response types.

use std::{convert::Infallible, sync::Arc};

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{
        sse::{Event, KeepAlive, Sse},
        IntoResponse,
    },
    Json,
};
use capsule_core::{
    ChatChunk, ChatRequest as CoreChatRequest, Message, MessageRole, ModelInfo, ToolDef,
};
use futures_util::{stream::StreamExt, Stream};
use serde::{Deserialize, Serialize};
use tracing::{info, warn};
use uuid::Uuid;

use crate::{
    error::AppError,
    state::{AppState, ConversationRecord},
};

// ─── Health ──────────────────────────────────────────────────────────────

pub async fn health() -> &'static str {
    "ok"
}

// ─── Providers ───────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct ProviderStatus {
    pub id: String,
    pub available: bool,
    pub models_count: usize,
}

pub async fn providers_list(State(state): State<AppState>) -> Json<Vec<ProviderStatus>> {
    let mut out = Vec::with_capacity(state.llms.len());
    for p in state.llms.iter() {
        let available = p.available().await;
        let models_count = if available {
            p.list_models().await.map(|v| v.len()).unwrap_or(0)
        } else {
            0
        };
        out.push(ProviderStatus {
            id: p.id().to_string(),
            available,
            models_count,
        });
    }
    Json(out)
}

// ─── Models ──────────────────────────────────────────────────────────────

pub async fn models_list(State(state): State<AppState>) -> Json<Vec<ModelInfo>> {
    let mut out = Vec::new();
    for p in state.llms.iter() {
        if !p.available().await {
            continue;
        }
        match p.list_models().await {
            Ok(mut models) => out.append(&mut models),
            Err(e) => warn!(provider = p.id(), error = %e, "models_list: provider failed"),
        }
    }
    Json(out)
}

#[derive(Debug, Serialize)]
pub struct CapabilitiesResponse {
    pub capabilities: Vec<capsule_core::Capability>,
}

pub async fn model_capabilities(
    State(state): State<AppState>,
    Path((provider, name)): Path<(String, String)>,
) -> Result<Json<CapabilitiesResponse>, AppError> {
    let p = state
        .find_llm(&provider)
        .ok_or_else(|| AppError::NotFound(format!("provider: {provider}")))?;
    let caps = p.capabilities(&name).await?;
    Ok(Json(CapabilitiesResponse { capabilities: caps }))
}

// ─── Ollama-specific: pull / load / unload / delete ──────────────────────

#[derive(Debug, Deserialize)]
pub struct PullRequest {
    pub name: String,
}

pub async fn ollama_pull(
    State(state): State<AppState>,
    Json(req): Json<PullRequest>,
) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, AppError> {
    info!(model = %req.name, "ollama: pull start");
    let stream = state.ollama.pull_stream(&req.name).await?;
    let mapped = stream.map(|res| {
        let event = match res {
            Ok(chunk) => {
                let json = serde_json::to_string(&serde_json::json!({
                    "status": chunk.status,
                    "digest": chunk.digest,
                    "total": chunk.total,
                    "completed": chunk.completed,
                }))
                .unwrap_or_else(|_| "{}".to_string());
                Event::default().event("progress").data(json)
            }
            Err(e) => Event::default().event("error").data(
                serde_json::to_string(&serde_json::json!({ "error": e.to_string() }))
                    .unwrap_or_else(|_| "{}".to_string()),
            ),
        };
        Ok::<_, Infallible>(event)
    });
    Ok(Sse::new(mapped).keep_alive(KeepAlive::default()))
}

pub async fn ollama_load(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> Result<StatusCode, AppError> {
    info!(model = %name, "ollama: load");
    state.ollama.load_model(&name).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn ollama_unload(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> Result<StatusCode, AppError> {
    info!(model = %name, "ollama: unload");
    state.ollama.unload_model(&name).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn ollama_delete(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> Result<StatusCode, AppError> {
    info!(model = %name, "ollama: delete");
    state.ollama.delete_model(&name).await?;
    Ok(StatusCode::NO_CONTENT)
}

// ─── Chat stream ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
pub struct ChatStreamApiRequest {
    pub provider: String,
    pub model: String,
    /// Новое user-сообщение (история подтягивается из conversation_id если есть).
    pub message: String,
    /// Опциональные base64-изображения для vision-моделей.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub images: Option<Vec<String>>,
    /// Если указан — история подгружается и обновляется в этой conversation.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub conversation_id: Option<Uuid>,
    /// System prompt (опц., подмешивается ПЕРЕД историей).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub system: Option<String>,
    /// Включить tools (default `false`). Если модель не поддерживает —
    /// провайдер игнорирует gracefully.
    #[serde(default)]
    pub enable_tools: bool,
    /// Список tools (используется только если `enable_tools=true`).
    #[serde(default)]
    pub tools: Vec<ToolDef>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
}

pub async fn chat_stream(
    State(state): State<AppState>,
    Json(req): Json<ChatStreamApiRequest>,
) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, AppError> {
    let provider = state
        .find_llm(&req.provider)
        .ok_or_else(|| AppError::NotFound(format!("provider: {}", req.provider)))?;

    // Собрать историю: load saved messages если conversation_id указан.
    let mut messages: Vec<Message> = Vec::new();
    if let Some(id) = req.conversation_id {
        let convs = state.conversations.lock().await;
        if let Some(rec) = convs.get(&id) {
            messages.extend(rec.messages.clone());
        } else {
            return Err(AppError::NotFound(format!("conversation: {id}")));
        }
    }

    let user_msg = Message {
        role: MessageRole::User,
        content: req.message.clone(),
        images: req.images.clone(),
        tool_call_id: None,
    };
    messages.push(user_msg.clone());

    let core_req = CoreChatRequest {
        provider: req.provider.clone(),
        model: req.model.clone(),
        messages,
        system: req.system.clone(),
        enable_tools: req.enable_tools,
        tools: req.tools.clone(),
        temperature: req.temperature,
    };

    info!(
        provider = %core_req.provider,
        model = %core_req.model,
        msg_count = core_req.messages.len(),
        enable_tools = core_req.enable_tools,
        "chat_stream: dispatching to provider"
    );

    let upstream = provider.chat_stream(core_req).await?;

    let state_arc: Arc<AppState> = Arc::new(state);
    let conv_id = req.conversation_id;
    let provider_id = req.provider.clone();
    let model_id = req.model.clone();
    let user_msg_arc = Arc::new(user_msg);

    let sse_stream = upstream.then(move |chunk| {
        let state_arc = state_arc.clone();
        let user_msg_arc = user_msg_arc.clone();
        let provider_id = provider_id.clone();
        let model_id = model_id.clone();
        async move {
            if let ChatChunk::Done {
                content,
                tool_calls: _,
            } = &chunk
            {
                if let Some(id) = conv_id {
                    let mut convs = state_arc.conversations.lock().await;
                    if let Some(rec) = convs.get_mut(&id) {
                        rec.provider.get_or_insert(provider_id);
                        rec.model.get_or_insert(model_id);
                        rec.messages.push((*user_msg_arc).clone());
                        rec.messages.push(Message {
                            role: MessageRole::Assistant,
                            content: content.clone(),
                            images: None,
                            tool_call_id: None,
                        });
                    }
                }
            }
            let event_name = chunk_event_name(&chunk);
            let json = serde_json::to_string(&chunk).unwrap_or_else(|_| "{}".to_string());
            Ok::<_, Infallible>(Event::default().event(event_name).data(json))
        }
    });

    Ok(Sse::new(sse_stream).keep_alive(KeepAlive::default()))
}

fn chunk_event_name(chunk: &ChatChunk) -> &'static str {
    match chunk {
        ChatChunk::Token { .. } => "token",
        ChatChunk::ToolCall { .. } => "tool_call",
        ChatChunk::Done { .. } => "done",
        ChatChunk::Error { .. } => "error",
    }
}

// ─── Conversations CRUD ──────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct ConversationSummary {
    pub id: Uuid,
    pub created_at_ms: u64,
    pub provider: Option<String>,
    pub model: Option<String>,
    pub message_count: usize,
}

pub async fn conversation_create(
    State(state): State<AppState>,
) -> Json<ConversationRecord> {
    let rec = ConversationRecord::new();
    let mut convs = state.conversations.lock().await;
    convs.insert(rec.id, rec.clone());
    Json(rec)
}

pub async fn conversation_list(
    State(state): State<AppState>,
) -> Json<Vec<ConversationSummary>> {
    let convs = state.conversations.lock().await;
    let mut out: Vec<ConversationSummary> = convs
        .values()
        .map(|r| ConversationSummary {
            id: r.id,
            created_at_ms: r.created_at_ms,
            provider: r.provider.clone(),
            model: r.model.clone(),
            message_count: r.messages.len(),
        })
        .collect();
    out.sort_by_key(|s| s.created_at_ms);
    Json(out)
}

pub async fn conversation_get(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ConversationRecord>, AppError> {
    let convs = state.conversations.lock().await;
    match convs.get(&id) {
        Some(r) => Ok(Json(r.clone())),
        None => Err(AppError::NotFound(format!("conversation: {id}"))),
    }
}

pub async fn conversation_delete(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let mut convs = state.conversations.lock().await;
    if convs.remove(&id).is_some() {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(AppError::NotFound(format!("conversation: {id}")))
    }
}

// ─── Conversation message append (для tools-loop, если когда-нибудь
//     понадобится явно дописать tool-result или system-сообщение без
//     полного chat-stream цикла). Пока не используется, оставлен как
//     заготовка контракта.) ────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct AppendMessageRequest {
    pub role: MessageRole,
    pub content: String,
    #[serde(default)]
    pub images: Option<Vec<String>>,
    #[serde(default)]
    pub tool_call_id: Option<String>,
}

pub async fn conversation_append(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<AppendMessageRequest>,
) -> Result<impl IntoResponse, AppError> {
    let mut convs = state.conversations.lock().await;
    let rec = convs
        .get_mut(&id)
        .ok_or_else(|| AppError::NotFound(format!("conversation: {id}")))?;
    rec.messages.push(Message {
        role: req.role,
        content: req.content,
        images: req.images,
        tool_call_id: req.tool_call_id,
    });
    Ok(StatusCode::NO_CONTENT)
}
