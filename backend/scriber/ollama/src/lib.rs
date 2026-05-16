use serde::{Deserialize, Serialize};

pub const DEFAULT_HOST: &str = "http://localhost:11434";

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("http: {0}")]
    Http(#[from] reqwest::Error),
    #[error("decode: {0}")]
    Decode(String),
}

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Clone, Debug)]
pub struct OllamaClient {
    http: reqwest::Client,
    host: String,
}

impl Default for OllamaClient {
    fn default() -> Self {
        Self::new(DEFAULT_HOST)
    }
}

impl OllamaClient {
    pub fn new(host: impl Into<String>) -> Self {
        Self {
            http: reqwest::Client::new(),
            host: host.into(),
        }
    }

    pub async fn list_models(&self) -> Result<ModelList> {
        let url = format!("{}/api/tags", self.host);
        let resp = self.http.get(url).send().await?.error_for_status()?;
        Ok(resp.json().await?)
    }

    pub async fn generate(&self, req: &GenerateRequest) -> Result<GenerateResponse> {
        let url = format!("{}/api/generate", self.host);
        let body = serde_json::json!({
            "model": req.model,
            "prompt": req.prompt,
            "stream": false,
        });
        let resp = self.http.post(url).json(&body).send().await?.error_for_status()?;
        Ok(resp.json().await?)
    }

    pub async fn chat(&self, opts: &ChatOptions) -> Result<ChatResponse> {
        let url = format!("{}/api/chat", self.host);
        let mut body = serde_json::json!({
            "model": opts.model,
            "messages": opts.messages,
            "stream": false,
        });
        if opts.send_tools {
            body["tools"] = serde_json::json!(opts.tools);
        }
        let resp = self.http.post(url).json(&body).send().await?.error_for_status()?;
        Ok(resp.json().await?)
    }

    /// `GET /api/ps` — list of models currently loaded in memory (with
    /// keep_alive > 0). Used to flag "running" state in the model picker UI.
    pub async fn running_models(&self) -> Result<RunningList> {
        let url = format!("{}/api/ps", self.host);
        let resp = self.http.get(url).send().await?.error_for_status()?;
        Ok(resp.json().await?)
    }

    /// `DELETE /api/delete` — remove a model from local disk.
    pub async fn delete_model(&self, name: &str) -> Result<()> {
        let url = format!("{}/api/delete", self.host);
        let body = serde_json::json!({ "name": name });
        self.http
            .delete(url)
            .json(&body)
            .send()
            .await?
            .error_for_status()?;
        Ok(())
    }

    /// Loads or unloads a model from memory via `/api/generate` with an
    /// empty prompt and explicit `keep_alive`. Convention:
    /// - `-1` → keep loaded forever.
    /// -  `0` → unload immediately.
    pub async fn set_keep_alive(&self, name: &str, keep_alive: i64) -> Result<()> {
        let url = format!("{}/api/generate", self.host);
        let body = serde_json::json!({
            "model": name,
            "prompt": "",
            "keep_alive": keep_alive,
            "stream": false,
        });
        self.http.post(url).json(&body).send().await?.error_for_status()?;
        Ok(())
    }

    /// `POST /api/pull` — download a model. NDJSON stream of progress events:
    /// `{ status, digest?, total?, completed? }`. Yields each parsed line.
    pub fn pull_stream(
        &self,
        name: String,
    ) -> impl futures_util::Stream<Item = Result<PullChunk>> + Send + 'static {
        let http = self.http.clone();
        let url = format!("{}/api/pull", self.host);
        async_stream::try_stream! {
            let body = serde_json::json!({ "name": name, "stream": true });
            let resp = http.post(url).json(&body).send().await?.error_for_status()?;
            let mut byte_stream = resp.bytes_stream();
            let mut buf: Vec<u8> = Vec::new();
            use futures_util::StreamExt;
            while let Some(chunk) = byte_stream.next().await {
                let chunk = chunk?;
                buf.extend_from_slice(&chunk);
                while let Some(pos) = buf.iter().position(|&b| b == b'\n') {
                    let line: Vec<u8> = buf.drain(..=pos).collect();
                    let line = &line[..line.len() - 1];
                    if line.is_empty() { continue; }
                    let parsed: PullChunk = serde_json::from_slice(line)
                        .map_err(|e| Error::Decode(e.to_string()))?;
                    yield parsed;
                }
            }
            if !buf.is_empty() {
                let parsed: PullChunk = serde_json::from_slice(&buf)
                    .map_err(|e| Error::Decode(e.to_string()))?;
                yield parsed;
            }
        }
    }

    pub fn chat_stream(
        &self,
        opts: ChatOptions,
    ) -> impl futures_util::Stream<Item = Result<ChatChunk>> + Send + 'static {
        let http = self.http.clone();
        let url = format!("{}/api/chat", self.host);
        async_stream::try_stream! {
            let mut body = serde_json::json!({
                "model": opts.model,
                "messages": opts.messages,
                "stream": true,
            });
            if opts.send_tools {
                body["tools"] = serde_json::json!(opts.tools);
            }
            let resp = http.post(url).json(&body).send().await?.error_for_status()?;
            let mut byte_stream = resp.bytes_stream();
            let mut buf: Vec<u8> = Vec::new();
            use futures_util::StreamExt;
            while let Some(chunk) = byte_stream.next().await {
                let chunk = chunk?;
                buf.extend_from_slice(&chunk);
                while let Some(pos) = buf.iter().position(|&b| b == b'\n') {
                    let line: Vec<u8> = buf.drain(..=pos).collect();
                    let line = &line[..line.len() - 1];
                    if line.is_empty() {
                        continue;
                    }
                    let parsed: ChatChunk = serde_json::from_slice(line)
                        .map_err(|e| Error::Decode(e.to_string()))?;
                    yield parsed;
                }
            }
            if !buf.is_empty() {
                let parsed: ChatChunk = serde_json::from_slice(&buf)
                    .map_err(|e| Error::Decode(e.to_string()))?;
                yield parsed;
            }
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ModelList {
    pub models: Vec<ModelInfo>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ModelInfo {
    pub name: String,
    #[serde(default)]
    pub size: u64,
    #[serde(default)]
    pub modified_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateRequest {
    pub model: String,
    pub prompt: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GenerateResponse {
    pub model: String,
    pub response: String,
    #[serde(default)]
    pub done: bool,
}

#[derive(Debug, Clone)]
pub struct ChatOptions {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    pub tools: Vec<Tool>,
    /// When false, tools are NOT sent to ollama (`/api/chat` request omits the
    /// `tools` field). Used in raw mode where tool definitions are injected
    /// into the system prompt instead and tool calls are parsed from content.
    pub send_tools: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub content: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tool_calls: Vec<ToolCall>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub function: ToolCallFunction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallFunction {
    pub name: String,
    pub arguments: serde_json::Value,
}

#[derive(Debug, Clone, Serialize)]
pub struct Tool {
    #[serde(rename = "type")]
    pub kind: &'static str,
    pub function: ToolDef,
}

#[derive(Debug, Clone, Serialize)]
pub struct ToolDef {
    pub name: String,
    pub description: String,
    pub parameters: serde_json::Value,
}

#[derive(Debug, Deserialize)]
pub struct ChatResponse {
    pub model: String,
    pub message: ChatMessage,
    #[serde(default)]
    pub done: bool,
}

#[derive(Debug, Deserialize)]
pub struct ChatChunk {
    pub model: String,
    #[serde(default)]
    pub message: Option<ChatMessage>,
    #[serde(default)]
    pub done: bool,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct RunningList {
    #[serde(default)]
    pub models: Vec<RunningModel>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct RunningModel {
    pub name: String,
    #[serde(default)]
    pub model: String,
    #[serde(default)]
    pub expires_at: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct PullChunk {
    pub status: String,
    #[serde(default)]
    pub digest: Option<String>,
    #[serde(default)]
    pub total: Option<u64>,
    #[serde(default)]
    pub completed: Option<u64>,
}
