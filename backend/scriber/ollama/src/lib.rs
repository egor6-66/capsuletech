//! Ollama implementation of [`capsule_core::LlmBackend`].
//!
//! Реализует контракт через Ollama HTTP API (`http://localhost:11434` по умолчанию):
//! - `GET /api/tags` → [`LlmBackend::list_models`]
//! - `POST /api/show` → [`LlmBackend::capabilities`]
//! - `POST /api/chat` (NDJSON stream) → [`LlmBackend::chat_stream`]
//! - `POST /api/pull` → [`OllamaBackend::pull_stream`] (provider-specific)
//! - `DELETE /api/delete` → [`OllamaBackend::delete_model`]
//! - `POST /api/generate` (`prompt=""`) → [`OllamaBackend::set_keep_alive`]

#![forbid(unsafe_code)]
#![warn(missing_docs)]

use std::time::Duration;

use async_trait::async_trait;
use capsule_core::{
    BoxStream, Capability, ChatChunk, ChatRequest, Error, LlmBackend, Message, MessageRole,
    ModelInfo, Result, ToolCall, ToolDef,
};
use futures_util::StreamExt;
use tracing::{debug, warn};

mod wire;

/// Re-export wire types для integration-tests из server'а.
pub use wire::PullChunk;

const DEFAULT_HOST: &str = "http://localhost:11434";
const AVAILABLE_TIMEOUT: Duration = Duration::from_millis(1500);

/// Backend для Ollama daemon.
pub struct OllamaBackend {
    host: String,
    client: reqwest::Client,
}

impl OllamaBackend {
    /// Создать backend с дефолтным host'ом (`http://localhost:11434`).
    pub fn new() -> Self {
        Self::with_host(DEFAULT_HOST.to_string())
    }

    /// Создать backend с кастомным host'ом.
    pub fn with_host(host: String) -> Self {
        let client = reqwest::Client::builder()
            .build()
            .expect("reqwest::Client::builder");
        Self { host, client }
    }

    /// Host daemon'а (для диагностики).
    pub fn host(&self) -> &str {
        &self.host
    }

    /// Запустить SSE-pull модели. Возвращает stream [`PullChunk`].
    /// При ошибке HTTP — первый эмит будет внутри stream'а как `Err`.
    pub async fn pull_stream(&self, name: &str) -> Result<BoxStream<Result<PullChunk>>> {
        let url = format!("{}/api/pull", self.host);
        let body = wire::PullRequest { name, stream: true };
        let response = self
            .client
            .post(url)
            .json(&body)
            .send()
            .await
            .map_err(map_reqwest)?;
        let status = response.status();
        if !status.is_success() {
            let message = response.text().await.unwrap_or_default();
            return Err(Error::Provider {
                status: status.as_u16(),
                message,
            });
        }
        let stream = ndjson_stream::<PullChunk>(response);
        Ok(Box::pin(stream))
    }

    /// Загрузить модель в память (Ollama `keep_alive = -1`).
    pub async fn load_model(&self, name: &str) -> Result<()> {
        self.set_keep_alive(name, -1).await
    }

    /// Выгрузить модель (Ollama `keep_alive = 0`).
    pub async fn unload_model(&self, name: &str) -> Result<()> {
        self.set_keep_alive(name, 0).await
    }

    /// Удалить модель (DELETE /api/delete).
    pub async fn delete_model(&self, name: &str) -> Result<()> {
        let url = format!("{}/api/delete", self.host);
        let response = self
            .client
            .delete(url)
            .json(&wire::DeleteRequest { name })
            .send()
            .await
            .map_err(map_reqwest)?;
        let status = response.status();
        if status == reqwest::StatusCode::NOT_FOUND {
            return Err(Error::NotFound(name.to_string()));
        }
        if !status.is_success() {
            let message = response.text().await.unwrap_or_default();
            return Err(Error::Provider {
                status: status.as_u16(),
                message,
            });
        }
        Ok(())
    }

    /// Внутренний keep_alive setter — POST /api/generate с пустым prompt'ом.
    async fn set_keep_alive(&self, name: &str, keep_alive: i64) -> Result<()> {
        let url = format!("{}/api/generate", self.host);
        let body = wire::GenerateRequest {
            model: name,
            prompt: "",
            stream: false,
            keep_alive,
        };
        let response = self
            .client
            .post(url)
            .json(&body)
            .send()
            .await
            .map_err(map_reqwest)?;
        let status = response.status();
        if !status.is_success() {
            let message = response.text().await.unwrap_or_default();
            return Err(Error::Provider {
                status: status.as_u16(),
                message,
            });
        }
        Ok(())
    }
}

impl Default for OllamaBackend {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl LlmBackend for OllamaBackend {
    fn id(&self) -> &str {
        "ollama"
    }

    async fn available(&self) -> bool {
        // Короткий HEAD-style probe на /api/tags. Если daemon up — 200.
        let url = format!("{}/api/tags", self.host);
        match self
            .client
            .get(url)
            .timeout(AVAILABLE_TIMEOUT)
            .send()
            .await
        {
            Ok(resp) => resp.status().is_success(),
            Err(_) => false,
        }
    }

    async fn list_models(&self) -> Result<Vec<ModelInfo>> {
        let url = format!("{}/api/tags", self.host);
        let response = self
            .client
            .get(url)
            .send()
            .await
            .map_err(map_reqwest)?;
        let status = response.status();
        if !status.is_success() {
            let message = response.text().await.unwrap_or_default();
            return Err(Error::Provider {
                status: status.as_u16(),
                message,
            });
        }
        let tags: wire::TagsResponse = response.json().await.map_err(map_reqwest)?;
        Ok(tags.models.into_iter().map(tag_to_info).collect())
    }

    async fn capabilities(&self, model: &str) -> Result<Vec<Capability>> {
        let url = format!("{}/api/show", self.host);
        let response = self
            .client
            .post(url)
            .json(&wire::ShowRequest { name: model })
            .send()
            .await
            .map_err(map_reqwest)?;
        let status = response.status();
        if status == reqwest::StatusCode::NOT_FOUND {
            return Err(Error::NotFound(model.to_string()));
        }
        if !status.is_success() {
            let message = response.text().await.unwrap_or_default();
            return Err(Error::Provider {
                status: status.as_u16(),
                message,
            });
        }
        let show: wire::ShowResponse = response.json().await.map_err(map_reqwest)?;
        Ok(show
            .capabilities
            .iter()
            .filter_map(|c| capability_from_str(c))
            .collect())
    }

    async fn chat_stream(&self, req: ChatRequest) -> Result<BoxStream<ChatChunk>> {
        let url = format!("{}/api/chat", self.host);
        let body = build_chat_request(&req);
        let response = self
            .client
            .post(url)
            .json(&body)
            .send()
            .await
            .map_err(map_reqwest)?;
        let status = response.status();
        if !status.is_success() {
            let message = response.text().await.unwrap_or_default();
            return Err(Error::Provider {
                status: status.as_u16(),
                message,
            });
        }
        Ok(Box::pin(ollama_chat_stream(response)))
    }
}

/// NDJSON-stream → [`ChatChunk`] events.
///
/// Внутри: разбираем wire::ChatChunk, накапливаем content, эмиттим Token'ы,
/// финальный `done=true` → ChatChunk::Done с tool_calls.
fn ollama_chat_stream(response: reqwest::Response) -> impl futures_util::Stream<Item = ChatChunk> {
    async_stream::stream! {
        let mut bytes_stream = response.bytes_stream();
        let mut buf = bytes::BytesMut::new();
        let mut accumulated = String::new();

        while let Some(chunk_result) = bytes_stream.next().await {
            match chunk_result {
                Ok(bytes) => {
                    buf.extend_from_slice(&bytes);
                    while let Some(nl_pos) = buf.iter().position(|&b| b == b'\n') {
                        let line_bytes = buf.split_to(nl_pos + 1);
                        let line = match std::str::from_utf8(&line_bytes[..line_bytes.len() - 1]) {
                            Ok(s) => s.trim(),
                            Err(e) => {
                                yield ChatChunk::Error { message: format!("utf-8: {e}") };
                                return;
                            }
                        };
                        if line.is_empty() {
                            continue;
                        }
                        match serde_json::from_str::<wire::ChatChunk>(line) {
                            Ok(parsed) => {
                                let content = parsed.message.content.clone();
                                if !content.is_empty() {
                                    accumulated.push_str(&content);
                                    yield ChatChunk::Token { content };
                                }
                                if parsed.done {
                                    let tool_calls = parsed
                                        .message
                                        .tool_calls
                                        .unwrap_or_default()
                                        .into_iter()
                                        .enumerate()
                                        .map(|(i, tc)| convert_ollama_tool_call(i, tc))
                                        .collect::<Vec<_>>();
                                    yield ChatChunk::Done {
                                        content: std::mem::take(&mut accumulated),
                                        tool_calls,
                                    };
                                    return;
                                }
                            }
                            Err(e) => {
                                warn!(error = %e, line, "ollama: failed to parse NDJSON chunk");
                                yield ChatChunk::Error { message: format!("parse: {e}") };
                                return;
                            }
                        }
                    }
                }
                Err(e) => {
                    yield ChatChunk::Error { message: format!("transport: {e}") };
                    return;
                }
            }
        }
        // Stream закрылся без done=true — отправим Done с тем что накопили
        // (мы попадаем сюда только если внутри loop не сделали `return`).
        debug!("ollama: stream closed without done flag, emitting Done with accumulated content");
        yield ChatChunk::Done {
            content: std::mem::take(&mut accumulated),
            tool_calls: vec![],
        };
    }
}

/// Generic NDJSON-stream parser (для pull_stream).
fn ndjson_stream<T>(response: reqwest::Response) -> impl futures_util::Stream<Item = Result<T>>
where
    T: for<'de> serde::Deserialize<'de> + Send + 'static,
{
    async_stream::stream! {
        let mut bytes_stream = response.bytes_stream();
        let mut buf = bytes::BytesMut::new();
        while let Some(chunk_result) = bytes_stream.next().await {
            match chunk_result {
                Ok(bytes) => {
                    buf.extend_from_slice(&bytes);
                    while let Some(nl_pos) = buf.iter().position(|&b| b == b'\n') {
                        let line_bytes = buf.split_to(nl_pos + 1);
                        let line = match std::str::from_utf8(&line_bytes[..line_bytes.len() - 1]) {
                            Ok(s) => s.trim(),
                            Err(e) => {
                                yield Err(Error::Transport(format!("utf-8: {e}")));
                                return;
                            }
                        };
                        if line.is_empty() { continue; }
                        match serde_json::from_str::<T>(line) {
                            Ok(parsed) => yield Ok(parsed),
                            Err(e) => yield Err(Error::Serde(e)),
                        }
                    }
                }
                Err(e) => {
                    yield Err(Error::Transport(format!("{e}")));
                    return;
                }
            }
        }
    }
}

// ─── Conversion helpers ────────────────────────────────────────────────────

fn tag_to_info(m: wire::TagModel) -> ModelInfo {
    let family = m.details.as_ref().and_then(|d| d.family.clone());
    ModelInfo {
        provider: "ollama".to_string(),
        name: m.name,
        capabilities: vec![], // lazy, fetch via capabilities() on-demand
        size: m.size,
        family,
    }
}

fn capability_from_str(s: &str) -> Option<Capability> {
    match s.to_ascii_lowercase().as_str() {
        "completion" => Some(Capability::Completion),
        "tools" => Some(Capability::Tools),
        "vision" => Some(Capability::Vision),
        "embedding" | "embed" => Some(Capability::Embedding),
        _ => None, // "thinking", "insert" и пр. — игнорируем
    }
}

fn role_to_str(r: MessageRole) -> &'static str {
    match r {
        MessageRole::System => "system",
        MessageRole::User => "user",
        MessageRole::Assistant => "assistant",
        MessageRole::Tool => "tool",
    }
}

fn message_to_wire(m: &Message) -> wire::ChatMessage {
    wire::ChatMessage {
        role: role_to_str(m.role).to_string(),
        content: m.content.clone(),
        images: m.images.clone(),
        tool_calls: None,
        tool_call_id: m.tool_call_id.clone(),
    }
}

fn tool_def_to_wire(t: &ToolDef) -> serde_json::Value {
    serde_json::json!({
        "type": "function",
        "function": {
            "name": t.name,
            "description": t.description,
            "parameters": t.parameters,
        }
    })
}

fn build_chat_request(req: &ChatRequest) -> wire::ChatRequest {
    let mut messages: Vec<wire::ChatMessage> = Vec::with_capacity(req.messages.len() + 1);
    if let Some(sys) = &req.system {
        messages.push(wire::ChatMessage {
            role: "system".to_string(),
            content: sys.clone(),
            images: None,
            tool_calls: None,
            tool_call_id: None,
        });
    }
    for m in &req.messages {
        messages.push(message_to_wire(m));
    }
    let tools = if req.enable_tools {
        req.tools.iter().map(tool_def_to_wire).collect()
    } else {
        vec![]
    };
    let options = req.temperature.map(|t| wire::ChatOptions {
        temperature: Some(t),
    });
    wire::ChatRequest {
        model: req.model.clone(),
        messages,
        stream: true,
        tools,
        options,
    }
}

fn convert_ollama_tool_call(index: usize, tc: wire::OllamaToolCall) -> ToolCall {
    ToolCall {
        id: format!("call_{index}"),
        name: tc.function.name,
        arguments: tc.function.arguments,
    }
}

fn map_reqwest(e: reqwest::Error) -> Error {
    Error::Transport(e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn backend_id_is_ollama() {
        let backend = OllamaBackend::new();
        assert_eq!(backend.id(), "ollama");
    }

    #[test]
    fn default_host_is_localhost_11434() {
        let backend = OllamaBackend::new();
        assert_eq!(backend.host(), "http://localhost:11434");
    }

    #[test]
    fn custom_host_is_preserved() {
        let backend = OllamaBackend::with_host("http://192.168.1.10:11434".into());
        assert_eq!(backend.host(), "http://192.168.1.10:11434");
    }

    #[test]
    fn capability_from_str_maps_known_values() {
        assert_eq!(capability_from_str("completion"), Some(Capability::Completion));
        assert_eq!(capability_from_str("tools"), Some(Capability::Tools));
        assert_eq!(capability_from_str("vision"), Some(Capability::Vision));
        assert_eq!(capability_from_str("embedding"), Some(Capability::Embedding));
        assert_eq!(capability_from_str("embed"), Some(Capability::Embedding));
    }

    #[test]
    fn capability_from_str_ignores_unknown() {
        assert_eq!(capability_from_str("thinking"), None);
        assert_eq!(capability_from_str("insert"), None);
        assert_eq!(capability_from_str(""), None);
    }

    #[test]
    fn capability_from_str_is_case_insensitive() {
        assert_eq!(capability_from_str("Tools"), Some(Capability::Tools));
        assert_eq!(capability_from_str("VISION"), Some(Capability::Vision));
    }

    #[test]
    fn tag_to_info_preserves_size_and_family() {
        let tag = wire::TagModel {
            name: "qwen2.5:7b".into(),
            size: Some(1234),
            details: Some(wire::TagDetails {
                family: Some("qwen2".into()),
                families: None,
                parameter_size: None,
                quantization_level: None,
            }),
        };
        let info = tag_to_info(tag);
        assert_eq!(info.provider, "ollama");
        assert_eq!(info.name, "qwen2.5:7b");
        assert_eq!(info.size, Some(1234));
        assert_eq!(info.family.as_deref(), Some("qwen2"));
        assert!(info.capabilities.is_empty());
    }

    #[test]
    fn build_chat_request_prepends_system_message() {
        let req = ChatRequest {
            provider: "ollama".into(),
            model: "llama3".into(),
            messages: vec![Message {
                role: MessageRole::User,
                content: "hi".into(),
                images: None,
                tool_call_id: None,
            }],
            system: Some("You are helpful.".into()),
            enable_tools: false,
            tools: vec![],
            temperature: None,
        };
        let wire = build_chat_request(&req);
        assert_eq!(wire.model, "llama3");
        assert_eq!(wire.messages.len(), 2);
        assert_eq!(wire.messages[0].role, "system");
        assert_eq!(wire.messages[0].content, "You are helpful.");
        assert_eq!(wire.messages[1].role, "user");
        assert!(wire.tools.is_empty());
        assert!(wire.stream);
    }

    #[test]
    fn build_chat_request_includes_tools_only_when_enabled() {
        let tool = ToolDef {
            name: "read_file".into(),
            description: "Read a file".into(),
            parameters: serde_json::json!({"type":"object"}),
        };
        let req = ChatRequest {
            provider: "ollama".into(),
            model: "llama3".into(),
            messages: vec![],
            system: None,
            enable_tools: true,
            tools: vec![tool.clone()],
            temperature: None,
        };
        let wire = build_chat_request(&req);
        assert_eq!(wire.tools.len(), 1);

        let req_disabled = ChatRequest {
            enable_tools: false,
            ..req
        };
        let wire_disabled = build_chat_request(&req_disabled);
        assert!(wire_disabled.tools.is_empty());
    }

    #[test]
    fn message_to_wire_passes_images_through() {
        let m = Message {
            role: MessageRole::User,
            content: "describe".into(),
            images: Some(vec!["base64data".into()]),
            tool_call_id: None,
        };
        let wire = message_to_wire(&m);
        assert_eq!(wire.images.as_ref().unwrap().len(), 1);
    }

    #[test]
    fn convert_ollama_tool_call_assigns_synthetic_id() {
        let tc = wire::OllamaToolCall {
            function: wire::OllamaToolCallFn {
                name: "read_file".into(),
                arguments: serde_json::json!({"path": "x"}),
            },
        };
        let core = convert_ollama_tool_call(0, tc);
        assert_eq!(core.id, "call_0");
        assert_eq!(core.name, "read_file");
        assert_eq!(core.arguments["path"], "x");
    }

    #[test]
    fn tool_def_to_wire_wraps_in_function_envelope() {
        let t = ToolDef {
            name: "grep".into(),
            description: "Search files".into(),
            parameters: serde_json::json!({"type":"object","properties":{}}),
        };
        let wire = tool_def_to_wire(&t);
        assert_eq!(wire["type"], "function");
        assert_eq!(wire["function"]["name"], "grep");
    }
}
