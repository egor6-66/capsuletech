//! Shared application state.

use std::{
    collections::HashMap,
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};

use capsule_core::{LlmBackend, Message, ToolProvider};
use capsule_ollama::OllamaBackend;
use serde::Serialize;
use tokio::sync::Mutex;
use uuid::Uuid;

/// Stored conversation record (in-memory; P2 → SQLite).
#[derive(Debug, Clone, Serialize)]
pub struct ConversationRecord {
    pub id: Uuid,
    /// Epoch milliseconds (UTC). Простой формат без `chrono`-зависимости.
    pub created_at_ms: u64,
    /// Provider id зафиксирован после первого chat-сообщения.
    pub provider: Option<String>,
    /// Model name зафиксирована после первого chat-сообщения.
    pub model: Option<String>,
    pub messages: Vec<Message>,
}

impl ConversationRecord {
    pub fn new() -> Self {
        Self {
            id: Uuid::new_v4(),
            created_at_ms: now_ms(),
            provider: None,
            model: None,
            messages: Vec::new(),
        }
    }
}

pub fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Map of conversations, behind async-friendly mutex.
pub type ConversationsMap = Arc<Mutex<HashMap<Uuid, ConversationRecord>>>;

/// Vector of trait-object LLM backends shared across handlers.
pub type LlmList = Arc<Vec<Arc<dyn LlmBackend>>>;

/// Vector of trait-object tool providers shared across handlers.
pub type ToolList = Arc<Vec<Arc<dyn ToolProvider>>>;

/// Shared application state.
#[derive(Clone)]
pub struct AppState {
    /// Все LLM-providers (для `/providers` + `/chat/stream`).
    pub llms: LlmList,
    /// Все tool-providers (`P1`-scaffold; placeholder в P0).
    #[allow(dead_code)]
    pub tools: ToolList,
    /// Прямая ссылка на Ollama для provider-specific endpoints (`/models/ollama/*`).
    pub ollama: Arc<OllamaBackend>,
    /// In-memory conversations (P2 → persistence).
    pub conversations: ConversationsMap,
}

impl AppState {
    /// Build default state: один `OllamaBackend` + пустые tool providers.
    pub fn new() -> Self {
        let ollama = Arc::new(OllamaBackend::new());
        let llms: Vec<Arc<dyn LlmBackend>> = vec![ollama.clone()];
        let tools: Vec<Arc<dyn ToolProvider>> = vec![];
        Self {
            llms: Arc::new(llms),
            tools: Arc::new(tools),
            ollama,
            conversations: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Найти LLM provider по id.
    pub fn find_llm(&self, id: &str) -> Option<Arc<dyn LlmBackend>> {
        self.llms.iter().find(|p| p.id() == id).cloned()
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
