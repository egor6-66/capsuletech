use std::{
    collections::HashMap,
    net::SocketAddr,
    path::PathBuf,
    sync::{Arc, Mutex},
};
use uuid::Uuid;

use axum::{
    extract::State,
    http::StatusCode,
    response::{
        sse::{Event, KeepAlive, Sse},
        IntoResponse, Json, Response,
    },
    routing::{delete, get, post},
    Router,
};
use std::convert::Infallible;
use std::time::Duration;
use capsule_fs::Workspace;
use capsule_ollama::{
    ChatMessage, ChatOptions, GenerateRequest, OllamaClient,
};
use capsule_tools::ToolKit;
use serde::{Deserialize, Serialize};
use tower_http::{cors::CorsLayer, trace::TraceLayer};

const MAX_TOOL_ITERATIONS: usize = 8;

type ConversationStore = Arc<Mutex<HashMap<Uuid, Vec<ChatMessage>>>>;

#[derive(Clone)]
struct AppState {
    ollama: OllamaClient,
    workspace: Workspace,
    toolkit: ToolKit,
    conversations: ConversationStore,
}

#[derive(Deserialize)]
struct GenerateApiRequest {
    model: String,
    prompt: String,
}

#[derive(Serialize)]
struct GenerateApiResponse {
    model: String,
    response: String,
}

#[derive(Deserialize)]
struct ChatApiRequest {
    model: String,
    prompt: String,
    #[serde(default)]
    system: Option<String>,
    #[serde(default)]
    conversation_id: Option<Uuid>,
    /// When true, tool definitions are injected into the system prompt as
    /// markdown and tool calls are parsed from content (```json fences).
    /// Used to unlock the qwen2.5-coder family that ignores the native
    /// ollama tools mechanism. Default false → native ollama tools.
    #[serde(default)]
    raw_tools: bool,
}

#[derive(Serialize)]
struct ConversationSummary {
    id: Uuid,
    messages: usize,
}

#[derive(Serialize)]
struct ConversationDetail {
    id: Uuid,
    messages: Vec<ChatMessage>,
}

#[derive(Serialize)]
struct ChatApiResponse {
    model: String,
    response: String,
    iterations: usize,
    trace: Vec<ToolTrace>,
}

#[derive(Serialize, Clone)]
struct ToolTrace {
    name: String,
    arguments: serde_json::Value,
    result: String,
}

#[derive(Deserialize)]
struct FsReadRequest {
    path: String,
}

#[derive(Deserialize)]
struct FsListRequest {
    #[serde(default)]
    path: Option<String>,
    #[serde(default)]
    max_entries: Option<usize>,
}

#[derive(Deserialize)]
struct FsWriteRequest {
    path: String,
    content: String,
    #[serde(default)]
    overwrite: bool,
}

#[derive(Deserialize)]
struct FsMkdirRequest {
    path: String,
}

#[derive(Deserialize)]
struct FsDiffRequest {
    path: String,
    blocks: Vec<capsule_fs::DiffBlock>,
}

#[derive(Deserialize)]
struct FsGrepRequest {
    pattern: String,
    #[serde(default)]
    path: Option<String>,
    #[serde(default)]
    max_matches: Option<usize>,
}

async fn health() -> &'static str {
    "ok"
}

async fn workspace_info(State(s): State<AppState>) -> Json<serde_json::Value> {
    Json(serde_json::json!({ "root": s.workspace.root() }))
}

/// Кураторский список рекомендованных моделей для UI каталога. Не из
/// ollama API (там нет search endpoint'а) — поддерживаем здесь руками.
/// Если хочется расширять — добавляй сюда же.
#[derive(Serialize, Clone)]
struct CatalogEntry {
    name: &'static str,
    description: &'static str,
    size_gb: f32,
    recommended_vram_gb: u32,
    recommended_ram_gb: u32,
    tags: &'static [&'static str],
}

const CATALOG: &[CatalogEntry] = &[
    CatalogEntry {
        name: "qwen2.5:14b",
        description: "Лучший выбор для агент-loop по нашим тестам (~28s, читает sandbox-эталон). Tools работают.",
        size_gb: 9.0,
        recommended_vram_gb: 12,
        recommended_ram_gb: 16,
        tags: &["agent", "tools", "recommended"],
    },
    CatalogEntry {
        name: "qwen2.5:7b",
        description: "Быстрее 14b, качество кодогенерации заметно ниже. Tools — да.",
        size_gb: 4.7,
        recommended_vram_gb: 8,
        recommended_ram_gb: 12,
        tags: &["agent", "tools"],
    },
    CatalogEntry {
        name: "llama3.1:8b",
        description: "Стабильный tool-loop, ~30s, код-качество среднее (5 типовых проблем в Entity).",
        size_gb: 4.7,
        recommended_vram_gb: 8,
        recommended_ram_gb: 12,
        tags: &["agent", "tools"],
    },
    CatalogEntry {
        name: "llama3.2:3b",
        description: "Лёгкая модель для слабых GPU. Подойдёт для прототипов и чата без code-tasks.",
        size_gb: 2.0,
        recommended_vram_gb: 4,
        recommended_ram_gb: 8,
        tags: &["chat"],
    },
    CatalogEntry {
        name: "qwen2.5-coder:7b",
        description: "Code completion (FIM). Tools-режим СЛОМАН в ollama (см. roadmap). Используй только как raw-completion.",
        size_gb: 4.7,
        recommended_vram_gb: 8,
        recommended_ram_gb: 12,
        tags: &["code", "no-tools"],
    },
    CatalogEntry {
        name: "qwen2.5-coder:14b",
        description: "Качественнее 7b на коде, но tools тоже не работают через ollama.",
        size_gb: 9.0,
        recommended_vram_gb: 12,
        recommended_ram_gb: 16,
        tags: &["code", "no-tools"],
    },
    CatalogEntry {
        name: "mistral:7b",
        description: "Универсальная, неплохой fallback. Tools — частично.",
        size_gb: 4.1,
        recommended_vram_gb: 8,
        recommended_ram_gb: 12,
        tags: &["chat"],
    },
];

#[derive(Serialize)]
struct ModelsResponse {
    installed: Vec<capsule_ollama::ModelInfo>,
    catalog: Vec<CatalogEntry>,
    running: Vec<String>,
}

async fn list_models(State(s): State<AppState>) -> Result<Json<ModelsResponse>, AppError> {
    let installed = s.ollama.list_models().await?;
    let running = s
        .ollama
        .running_models()
        .await
        .map(|r| r.models.into_iter().map(|m| m.name).collect())
        .unwrap_or_default();
    Ok(Json(ModelsResponse {
        installed: installed.models,
        catalog: CATALOG.to_vec(),
        running,
    }))
}

#[derive(Deserialize)]
struct PullApiRequest {
    name: String,
}

async fn pull_model(
    State(s): State<AppState>,
    Json(req): Json<PullApiRequest>,
) -> Sse<impl futures_util::Stream<Item = std::result::Result<Event, Infallible>>> {
    use futures_util::StreamExt;
    let ollama = s.ollama.clone();
    let name = req.name.clone();
    let stream = async_stream::stream! {
        let mut chunks = Box::pin(ollama.pull_stream(name.clone()));
        while let Some(chunk) = chunks.next().await {
            match chunk {
                Ok(c) => {
                    yield sse_event("progress", serde_json::json!({
                        "status": c.status,
                        "completed": c.completed,
                        "total": c.total,
                    }));
                }
                Err(e) => {
                    yield sse_event("error", serde_json::json!({
                        "message": format!("pull: {}", e),
                    }));
                    return;
                }
            }
        }
        yield sse_event("done", serde_json::json!({ "name": name }));
    };
    Sse::new(stream).keep_alive(KeepAlive::new().interval(Duration::from_secs(15)))
}

async fn load_model(
    State(s): State<AppState>,
    axum::extract::Path(name): axum::extract::Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    s.ollama.set_keep_alive(&name, -1).await?;
    Ok(Json(serde_json::json!({ "name": name, "loaded": true })))
}

async fn unload_model(
    State(s): State<AppState>,
    axum::extract::Path(name): axum::extract::Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    s.ollama.set_keep_alive(&name, 0).await?;
    Ok(Json(serde_json::json!({ "name": name, "loaded": false })))
}

async fn delete_model(
    State(s): State<AppState>,
    axum::extract::Path(name): axum::extract::Path<String>,
) -> Result<StatusCode, AppError> {
    s.ollama.delete_model(&name).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn generate(
    State(s): State<AppState>,
    Json(req): Json<GenerateApiRequest>,
) -> Result<Json<GenerateApiResponse>, AppError> {
    let res = s
        .ollama
        .generate(&GenerateRequest { model: req.model, prompt: req.prompt })
        .await?;
    Ok(Json(GenerateApiResponse { model: res.model, response: res.response }))
}

async fn create_conversation(
    State(s): State<AppState>,
) -> Json<ConversationDetail> {
    let id = Uuid::new_v4();
    s.conversations.lock().unwrap().insert(id, Vec::new());
    Json(ConversationDetail { id, messages: Vec::new() })
}

async fn list_conversations(
    State(s): State<AppState>,
) -> Json<Vec<ConversationSummary>> {
    let map = s.conversations.lock().unwrap();
    let out: Vec<ConversationSummary> = map
        .iter()
        .map(|(id, msgs)| ConversationSummary { id: *id, messages: msgs.len() })
        .collect();
    Json(out)
}

async fn get_conversation(
    State(s): State<AppState>,
    axum::extract::Path(id): axum::extract::Path<Uuid>,
) -> Result<Json<ConversationDetail>, AppError> {
    let map = s.conversations.lock().unwrap();
    let msgs = map
        .get(&id)
        .cloned()
        .ok_or_else(|| AppError(anyhow::anyhow!("conversation not found"), StatusCode::NOT_FOUND))?;
    Ok(Json(ConversationDetail { id, messages: msgs }))
}

async fn delete_conversation(
    State(s): State<AppState>,
    axum::extract::Path(id): axum::extract::Path<Uuid>,
) -> StatusCode {
    let removed = s.conversations.lock().unwrap().remove(&id).is_some();
    if removed { StatusCode::NO_CONTENT } else { StatusCode::NOT_FOUND }
}

async fn fs_read(
    State(s): State<AppState>,
    Json(req): Json<FsReadRequest>,
) -> Result<Json<capsule_fs::ReadResult>, AppError> {
    let res = s.workspace.read_text(&req.path).await?;
    Ok(Json(res))
}

async fn fs_write(
    State(s): State<AppState>,
    Json(req): Json<FsWriteRequest>,
) -> Result<Json<capsule_fs::WriteResult>, AppError> {
    let res = s
        .workspace
        .write_text(&req.path, &req.content, req.overwrite)
        .await?;
    Ok(Json(res))
}

async fn fs_mkdir(
    State(s): State<AppState>,
    Json(req): Json<FsMkdirRequest>,
) -> Result<Json<capsule_fs::DirCreateResult>, AppError> {
    let res = s.workspace.create_dir(&req.path).await?;
    Ok(Json(res))
}

async fn fs_diff(
    State(s): State<AppState>,
    Json(req): Json<FsDiffRequest>,
) -> Result<Json<capsule_fs::DiffResult>, AppError> {
    let res = s.workspace.apply_diff(&req.path, &req.blocks).await?;
    Ok(Json(res))
}

async fn fs_list(
    State(s): State<AppState>,
    Json(req): Json<FsListRequest>,
) -> Result<Json<capsule_fs::ListResult>, AppError> {
    let path = req.path.unwrap_or_else(|| ".".into());
    let max = req.max_entries.unwrap_or(500).min(2000);
    let res = s.workspace.list_dir(&path, max).await?;
    Ok(Json(res))
}

async fn fs_grep(
    State(s): State<AppState>,
    Json(req): Json<FsGrepRequest>,
) -> Result<Json<capsule_fs::GrepResult>, AppError> {
    let max = req.max_matches.unwrap_or(100).min(500);
    let res = s
        .workspace
        .grep(&req.pattern, req.path.as_deref(), max)
        .await?;
    Ok(Json(res))
}

async fn chat(
    State(s): State<AppState>,
    Json(req): Json<ChatApiRequest>,
) -> Result<Json<ChatApiResponse>, AppError> {
    let system = req.system.unwrap_or_else(|| default_system(&s.workspace));

    let mut messages: Vec<ChatMessage> = vec![
        ChatMessage { role: "system".into(), content: system, tool_calls: vec![] },
        ChatMessage { role: "user".into(), content: req.prompt, tool_calls: vec![] },
    ];

    let tools = s.toolkit.descriptions();
    let mut trace: Vec<ToolTrace> = Vec::new();
    let mut model_name = req.model.clone();

    for iter in 1..=MAX_TOOL_ITERATIONS {
        let resp = s
            .ollama
            .chat(&ChatOptions {
                model: req.model.clone(),
                messages: messages.clone(),
                tools: tools.clone(),
                send_tools: true,
            })
            .await?;

        model_name = resp.model;
        let assistant = resp.message;

        tracing::info!(
            iter,
            tool_calls = assistant.tool_calls.len(),
            content_len = assistant.content.len(),
            "chat response"
        );

        if assistant.tool_calls.is_empty() {
            return Ok(Json(ChatApiResponse {
                model: model_name,
                response: assistant.content,
                iterations: iter,
                trace,
            }));
        }

        messages.push(assistant.clone());

        for call in assistant.tool_calls {
            let name = call.function.name.clone();
            let args = call.function.arguments.clone();
            tracing::info!(tool = %name, args = %args, "tool call");

            let result = match s.toolkit.dispatch(&name, &args).await {
                Ok(out) => out,
                Err(e) => format!(r#"{{"error":"{}"}}"#, e),
            };

            trace.push(ToolTrace {
                name: name.clone(),
                arguments: args,
                result: result.clone(),
            });

            messages.push(ChatMessage {
                role: "tool".into(),
                content: result,
                tool_calls: vec![],
            });
        }
    }

    Err(AppError(
        anyhow::anyhow!("tool-use loop exceeded {MAX_TOOL_ITERATIONS} iterations"),
        StatusCode::INTERNAL_SERVER_ERROR,
    ))
}

async fn chat_stream(
    State(s): State<AppState>,
    Json(req): Json<ChatApiRequest>,
) -> Sse<impl futures_util::Stream<Item = std::result::Result<Event, Infallible>>> {
    use futures_util::StreamExt;

    let raw_tools = req.raw_tools;
    let mut system = req.system.unwrap_or_else(|| default_system(&s.workspace));
    if raw_tools {
        system.push_str("\n\n");
        system.push_str(&s.toolkit.descriptions_as_markdown());
    }
    let conversation_id = req.conversation_id;
    let store = s.conversations.clone();

    let mut messages: Vec<ChatMessage> = match conversation_id {
        Some(id) => {
            let mut map = store.lock().unwrap();
            let history = map.entry(id).or_insert_with(Vec::new);
            if history.is_empty() {
                history.push(ChatMessage { role: "system".into(), content: system, tool_calls: vec![] });
            }
            history.push(ChatMessage { role: "user".into(), content: req.prompt, tool_calls: vec![] });
            history.clone()
        }
        None => vec![
            ChatMessage { role: "system".into(), content: system, tool_calls: vec![] },
            ChatMessage { role: "user".into(), content: req.prompt, tool_calls: vec![] },
        ],
    };
    let tools = s.toolkit.descriptions();
    let ollama = s.ollama.clone();
    let toolkit = s.toolkit.clone();
    let model = req.model.clone();

    let stream = async_stream::stream! {
        for iter in 1..=MAX_TOOL_ITERATIONS {
            let opts = ChatOptions {
                model: model.clone(),
                messages: messages.clone(),
                tools: tools.clone(),
                send_tools: !raw_tools,
            };
            let mut chunks = Box::pin(ollama.chat_stream(opts));
            let mut accumulated_content = String::new();
            let mut accumulated_tool_calls: Vec<capsule_ollama::ToolCall> = Vec::new();
            let mut stream_failed = false;

            while let Some(chunk) = chunks.next().await {
                match chunk {
                    Ok(c) => {
                        if let Some(msg) = c.message {
                            if !msg.content.is_empty() {
                                accumulated_content.push_str(&msg.content);
                                yield sse_event("token", serde_json::json!({
                                    "iteration": iter,
                                    "content": msg.content,
                                }));
                            }
                            if !msg.tool_calls.is_empty() {
                                accumulated_tool_calls.extend(msg.tool_calls);
                            }
                        }
                        if c.done {
                            break;
                        }
                    }
                    Err(e) => {
                        yield sse_event("error", serde_json::json!({
                            "message": format!("ollama: {}", e),
                        }));
                        stream_failed = true;
                        break;
                    }
                }
            }

            if stream_failed {
                return;
            }

            let mut assistant = ChatMessage {
                role: "assistant".into(),
                content: accumulated_content.clone(),
                tool_calls: accumulated_tool_calls,
            };

            if raw_tools && assistant.tool_calls.is_empty() {
                let parsed = parse_raw_tool_calls(&assistant.content);
                if !parsed.is_empty() {
                    tracing::info!(iter, parsed = parsed.len(), "raw-mode: parsed tool calls from content");
                    assistant.tool_calls = parsed;
                }
            }

            tracing::info!(
                iter,
                tool_calls = assistant.tool_calls.len(),
                content_len = assistant.content.len(),
                "chat-stream iter end"
            );

            if assistant.tool_calls.is_empty() {
                messages.push(assistant.clone());
                if let Some(id) = conversation_id {
                    store.lock().unwrap().insert(id, messages.clone());
                }
                yield sse_event("done", serde_json::json!({
                    "iterations": iter,
                    "final": assistant.content,
                    "conversation_id": conversation_id,
                }));
                return;
            }

            messages.push(assistant.clone());

            for call in assistant.tool_calls {
                let name = call.function.name.clone();
                let args = call.function.arguments.clone();
                yield sse_event("tool_call", serde_json::json!({
                    "iteration": iter,
                    "name": name,
                    "arguments": args,
                }));

                let result = match toolkit.dispatch(&name, &args).await {
                    Ok(out) => out,
                    Err(e) => format!(r#"{{"error":"{}"}}"#, e),
                };

                yield sse_event("tool_result", serde_json::json!({
                    "iteration": iter,
                    "name": name,
                    "result": &result,
                }));

                messages.push(ChatMessage {
                    role: "tool".into(),
                    content: result,
                    tool_calls: vec![],
                });
            }
        }

        yield sse_event("error", serde_json::json!({
            "message": format!("tool-use loop exceeded {MAX_TOOL_ITERATIONS} iterations"),
        }));
    };

    Sse::new(stream).keep_alive(KeepAlive::new().interval(Duration::from_secs(15)))
}

/// In raw_tools mode the model emits tool calls as fenced JSON inside
/// assistant content. Find them and convert into synthetic ToolCall values
/// the existing dispatch loop already understands.
///
/// Accepts two shapes, in priority order:
///   1. ```json ... ```  fenced block (the documented format)
///   2. <tool_call> ... </tool_call>  (qwen native chat template fallback)
fn parse_raw_tool_calls(content: &str) -> Vec<capsule_ollama::ToolCall> {
    use regex::Regex;
    use std::sync::OnceLock;

    static RE_FENCE: OnceLock<Regex> = OnceLock::new();
    static RE_TAG: OnceLock<Regex> = OnceLock::new();
    let fence = RE_FENCE.get_or_init(|| {
        Regex::new(r"(?s)```(?:json)?\s*(\{[\s\S]*?\})\s*```").unwrap()
    });
    let tag = RE_TAG.get_or_init(|| {
        Regex::new(r"(?s)<tool_call>\s*(\{[\s\S]*?\})\s*</tool_call>").unwrap()
    });

    fn try_block(raw: &str, out: &mut Vec<capsule_ollama::ToolCall>) {
        let Ok(v) = serde_json::from_str::<serde_json::Value>(raw) else { return };
        let name = v.get("name").and_then(|n| n.as_str()).map(|s| s.to_string());
        let args = v
            .get("arguments")
            .cloned()
            .or_else(|| v.get("args").cloned())
            .unwrap_or(serde_json::Value::Object(Default::default()));
        if let Some(name) = name {
            out.push(capsule_ollama::ToolCall {
                function: capsule_ollama::ToolCallFunction { name, arguments: args },
            });
        }
    }

    let mut out: Vec<capsule_ollama::ToolCall> = Vec::new();
    for cap in fence.captures_iter(content) {
        try_block(&cap[1], &mut out);
    }
    if out.is_empty() {
        for cap in tag.captures_iter(content) {
            try_block(&cap[1], &mut out);
        }
    }
    out
}

fn sse_event(name: &str, data: serde_json::Value) -> std::result::Result<Event, Infallible> {
    Ok(Event::default().event(name).data(data.to_string()))
}

fn default_system(ws: &Workspace) -> String {
    format!(
        "You are a coding assistant operating on a real local project at `{root}`.\n\
         You DO have filesystem access via these tools:\n\
         - `read_file(path)` — read a UTF-8 text file.\n\
         - `list_dir(path)` — list the immediate entries of a directory (use \".\" for the root).\n\
         - `grep(pattern, path?, max_matches?)` — regex search across files; great for locating symbols, definitions, or usages. \
         Use the project's actual language syntax in the pattern (e.g. `fn ` for Rust, `function ` for JS, `def ` for Python). \
         If unsure of the language, run `list_dir` first.\n\n\
         CALLING A TOOL:\n\
         - To call a tool, your ENTIRE response MUST be a single JSON object on one line: \
         `{{\"name\": \"<tool>\", \"parameters\": {{...}}}}`. No prose, no code fences, no explanation, no markdown.\n\
         - NEVER describe a tool call in plain text or fenced code blocks — that is treated as a normal message, not a call.\n\
         - After you receive the tool result, you may answer the user normally.\n\n\
         RULES:\n\
         - NEVER reply with \"I cannot access files\" or \"please paste the file\" — that is wrong, you have the tools.\n\
         - When the user mentions a path, call the matching tool FIRST.\n\
         - If you don't know the exact path, use `list_dir` or `grep` to locate it before reading.\n\
         - Paths are always relative to the project root, use forward slashes, no absolute paths, no `..`.\n\
         - Cite the paths you read or matched in your final answer.",
        root = ws.root().display()
    )
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,tower_http=info".into()),
        )
        .init();

    let workspace_root = std::env::var("CAPSULE_WORKSPACE_ROOT")
        .map(PathBuf::from)
        .unwrap_or_else(|_| std::env::current_dir().expect("cwd"));
    let write_scope = std::env::var("CAPSULE_WRITE_SCOPE").ok();
    let workspace = Workspace::new(&workspace_root)?
        .with_write_scope(write_scope.as_deref())?;
    tracing::info!("workspace root: {}", workspace.root().display());
    if let Some(scope) = workspace.write_scope() {
        tracing::info!("write scope: {}", scope.display());
    } else {
        tracing::info!("write scope: <full workspace>");
    }

    let toolkit = ToolKit::new(workspace.clone());

    let state = AppState {
        ollama: OllamaClient::default(),
        workspace,
        toolkit,
        conversations: Arc::new(Mutex::new(HashMap::new())),
    };

    let app = Router::new()
        .route("/health", get(health))
        .route("/workspace", get(workspace_info))
        .route("/models", get(list_models))
        .route("/models/pull", post(pull_model))
        .route("/models/:name/load", post(load_model))
        .route("/models/:name/unload", post(unload_model))
        .route("/models/:name", delete(delete_model))
        .route("/generate", post(generate))
        .route("/chat", post(chat))
        .route("/chat/stream", post(chat_stream))
        .route("/conversations", post(create_conversation).get(list_conversations))
        .route("/conversations/:id", get(get_conversation).delete(delete_conversation))
        .route("/fs/read", post(fs_read))
        .route("/fs/list", post(fs_list))
        .route("/fs/grep", post(fs_grep))
        .route("/fs/write", post(fs_write))
        .route("/fs/mkdir", post(fs_mkdir))
        .route("/fs/diff", post(fs_diff))
        .with_state(state)
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http());

    let addr: SocketAddr = "127.0.0.1:8787".parse()?;
    tracing::info!("listening on http://{addr}");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

struct AppError(anyhow::Error, StatusCode);

impl From<capsule_fs::Error> for AppError {
    fn from(err: capsule_fs::Error) -> Self {
        use capsule_fs::Error::*;
        let status = match &err {
            Absolute(_) | Escape(_) | NotAFile(_) | NotADir(_) | BadRegex(_)
            | OutsideWriteScope { .. } | DiffEmpty | DiffSearchMissing { .. }
            | DiffSearchAmbiguous { .. } => StatusCode::BAD_REQUEST,
            AlreadyExists(_) => StatusCode::CONFLICT,
            Io(e) if e.kind() == std::io::ErrorKind::NotFound => StatusCode::NOT_FOUND,
            Io(_) => StatusCode::INTERNAL_SERVER_ERROR,
        };
        Self(anyhow::Error::from(err), status)
    }
}

impl From<capsule_ollama::Error> for AppError {
    fn from(err: capsule_ollama::Error) -> Self {
        Self(anyhow::Error::from(err), StatusCode::BAD_GATEWAY)
    }
}

impl From<capsule_tools::Error> for AppError {
    fn from(err: capsule_tools::Error) -> Self {
        Self(anyhow::Error::from(err), StatusCode::INTERNAL_SERVER_ERROR)
    }
}

impl From<anyhow::Error> for AppError {
    fn from(err: anyhow::Error) -> Self {
        Self(err, StatusCode::INTERNAL_SERVER_ERROR)
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        (self.1, format!("error: {:#}", self.0)).into_response()
    }
}
