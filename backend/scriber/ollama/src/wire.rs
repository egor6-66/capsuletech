//! Ollama HTTP wire-protocol types (private to this crate).
//!
//! Источник: <https://github.com/ollama/ollama/blob/main/docs/api.md>.
//!
//! Поля `pub` для cross-module use внутри crate; `missing_docs` отключён —
//! shape определяется внешним API, документировать каждое поле избыточно.

#![allow(missing_docs)]
#![allow(dead_code)] // wire-types preserve full shape; не все поля читаются — это норма

use serde::{Deserialize, Serialize};

/// `GET /api/tags` response.
#[derive(Debug, Clone, Deserialize)]
pub struct TagsResponse {
    pub models: Vec<TagModel>,
}

/// One model entry from `/api/tags`.
#[derive(Debug, Clone, Deserialize)]
pub struct TagModel {
    pub name: String,
    #[serde(default)]
    pub size: Option<u64>,
    #[serde(default)]
    pub details: Option<TagDetails>,
}

/// Nested details object from `/api/tags`.
#[derive(Debug, Clone, Deserialize)]
pub struct TagDetails {
    #[serde(default)]
    pub family: Option<String>,
    #[serde(default)]
    pub families: Option<Vec<String>>,
    #[serde(default)]
    pub parameter_size: Option<String>,
    #[serde(default)]
    pub quantization_level: Option<String>,
}

/// `POST /api/show` request.
#[derive(Debug, Serialize)]
pub struct ShowRequest<'a> {
    pub name: &'a str,
}

/// `POST /api/show` response (extract — есть много других полей).
#[derive(Debug, Clone, Deserialize)]
pub struct ShowResponse {
    /// Список capabilities — `"completion"`, `"tools"`, `"vision"`, `"embedding"`, `"thinking"`, ...
    #[serde(default)]
    pub capabilities: Vec<String>,
}

/// `POST /api/chat` request.
#[derive(Debug, Serialize)]
pub struct ChatRequest {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    pub stream: bool,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub tools: Vec<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<ChatOptions>,
}

/// Ollama-side message (роли + content + images + tool_calls).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    #[serde(default)]
    pub content: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub images: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<OllamaToolCall>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
}

/// Ollama tool_call shape.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaToolCall {
    pub function: OllamaToolCallFn,
}

/// Function payload внутри tool_call.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaToolCallFn {
    pub name: String,
    #[serde(default)]
    pub arguments: serde_json::Value,
}

/// Опции (temperature etc).
#[derive(Debug, Clone, Serialize, Default)]
pub struct ChatOptions {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
}

/// Один NDJSON-чанк из `POST /api/chat` (stream=true).
#[derive(Debug, Clone, Deserialize)]
pub struct ChatChunk {
    #[allow(dead_code)] // используется для tracing, не для логики
    #[serde(default)]
    pub model: String,
    pub message: ChatMessage,
    #[serde(default)]
    pub done: bool,
    #[serde(default)]
    pub done_reason: Option<String>,
}

/// `POST /api/generate` minimal body — используется только для `set_keep_alive` (`prompt=""`).
#[derive(Debug, Serialize)]
pub struct GenerateRequest<'a> {
    pub model: &'a str,
    pub prompt: &'a str,
    pub stream: bool,
    pub keep_alive: i64,
}

/// `POST /api/pull` body.
#[derive(Debug, Serialize)]
pub struct PullRequest<'a> {
    pub name: &'a str,
    pub stream: bool,
}

/// NDJSON-чанк из `POST /api/pull`.
#[derive(Debug, Clone, Deserialize)]
pub struct PullChunk {
    /// `"pulling manifest"`, `"downloading"`, `"verifying"`, `"success"` и т.п.
    pub status: String,
    /// SHA blob (если применимо).
    #[serde(default)]
    pub digest: Option<String>,
    /// Общий размер blob'а в байтах.
    #[serde(default)]
    pub total: Option<u64>,
    /// Загружено байт.
    #[serde(default)]
    pub completed: Option<u64>,
}

/// `DELETE /api/delete` body.
#[derive(Debug, Serialize)]
pub struct DeleteRequest<'a> {
    pub name: &'a str,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tags_response_parses_with_minimal_fields() {
        let json = r#"{"models":[{"name":"llama3.2:latest"}]}"#;
        let resp: TagsResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.models.len(), 1);
        assert_eq!(resp.models[0].name, "llama3.2:latest");
        assert!(resp.models[0].size.is_none());
        assert!(resp.models[0].details.is_none());
    }

    #[test]
    fn tags_response_parses_with_details() {
        let json = r#"{
            "models":[{
                "name":"qwen2.5-coder:7b",
                "size":4683087661,
                "details":{
                    "family":"qwen2",
                    "parameter_size":"7.6B",
                    "quantization_level":"Q4_K_M"
                }
            }]
        }"#;
        let resp: TagsResponse = serde_json::from_str(json).unwrap();
        let m = &resp.models[0];
        assert_eq!(m.size, Some(4683087661));
        assert_eq!(m.details.as_ref().unwrap().family.as_deref(), Some("qwen2"));
    }

    #[test]
    fn show_response_extracts_capabilities() {
        let json = r#"{
            "capabilities":["completion","tools","vision"],
            "modelfile":"...","parameters":"...","template":"...","details":{}
        }"#;
        let resp: ShowResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.capabilities, vec!["completion", "tools", "vision"]);
    }

    #[test]
    fn show_response_defaults_capabilities_to_empty() {
        let json = r#"{"modelfile":"..."}"#;
        let resp: ShowResponse = serde_json::from_str(json).unwrap();
        assert!(resp.capabilities.is_empty());
    }

    #[test]
    fn chat_chunk_parses_streaming_token() {
        let json = r#"{
            "model":"llama3.2",
            "created_at":"2026-05-22T12:00:00Z",
            "message":{"role":"assistant","content":"Hello"},
            "done":false
        }"#;
        let chunk: ChatChunk = serde_json::from_str(json).unwrap();
        assert_eq!(chunk.message.content, "Hello");
        assert!(!chunk.done);
    }

    #[test]
    fn chat_chunk_parses_final_with_tool_call() {
        let json = r#"{
            "model":"llama3.2",
            "message":{
                "role":"assistant",
                "content":"",
                "tool_calls":[{
                    "function":{"name":"read_file","arguments":{"path":"foo"}}
                }]
            },
            "done":true,
            "done_reason":"stop"
        }"#;
        let chunk: ChatChunk = serde_json::from_str(json).unwrap();
        assert!(chunk.done);
        let calls = chunk.message.tool_calls.unwrap();
        assert_eq!(calls.len(), 1);
        assert_eq!(calls[0].function.name, "read_file");
    }

    #[test]
    fn pull_chunk_parses_progress() {
        let json = r#"{"status":"downloading","digest":"sha256:abc","total":1000,"completed":250}"#;
        let chunk: PullChunk = serde_json::from_str(json).unwrap();
        assert_eq!(chunk.status, "downloading");
        assert_eq!(chunk.total, Some(1000));
        assert_eq!(chunk.completed, Some(250));
    }

    #[test]
    fn pull_chunk_parses_success() {
        let json = r#"{"status":"success"}"#;
        let chunk: PullChunk = serde_json::from_str(json).unwrap();
        assert_eq!(chunk.status, "success");
        assert!(chunk.completed.is_none());
    }
}
