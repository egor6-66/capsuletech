//! Trait [`LlmBackend`] — провайдер-агностичный контракт для LLM.

use async_trait::async_trait;

use crate::{
    error::Result,
    types::{Capability, ChatChunk, ChatRequest, ModelInfo},
    BoxStream,
};

/// LLM провайдер — backend для chat streaming.
///
/// Реализации:
/// - [`capsule_ollama::OllamaBackend`] — Ollama daemon (текущая)
/// - (P1) `OpenAIBackend`, `AnthropicBackend`, `GeminiBackend`
///
/// Все методы async; для streaming используется [`BoxStream`].
///
/// [`capsule_ollama::OllamaBackend`]: ../../../capsule_ollama/struct.OllamaBackend.html
/// [`BoxStream`]: crate::BoxStream
#[async_trait]
pub trait LlmBackend: Send + Sync {
    /// Уникальный ID провайдера (`"ollama"`, `"openai"`, ...).
    fn id(&self) -> &str;

    /// Доступен ли провайдер для запросов (e.g. Ollama daemon up).
    ///
    /// Дешёвая проверка — не делать full enumeration. Сервер вызывает её
    /// в `/providers` endpoint при каждом обращении.
    async fn available(&self) -> bool;

    /// Список моделей доступных у провайдера.
    ///
    /// Для Ollama — installed (через `/api/tags`).
    /// Для OpenAI/Anthropic — статический list поддерживаемых API-моделей.
    async fn list_models(&self) -> Result<Vec<ModelInfo>>;

    /// Capabilities конкретной модели. Используется сервером для решения
    /// игнорировать ли `enable_tools` / `images` в запросе.
    async fn capabilities(&self, model: &str) -> Result<Vec<Capability>>;

    /// Stream события chat-ответа.
    ///
    /// Реализация ответственна за:
    /// - Парсинг провайдер-специфичного wire-протокола (NDJSON, SSE, etc)
    /// - Эмиссию [`ChatChunk::Token`] по мере прихода контента
    /// - Финальный [`ChatChunk::Done`] с накопленным content + tool_calls
    /// - [`ChatChunk::Error`] при transport/parse failure
    ///
    /// [`ChatChunk::Token`]: crate::ChatChunk::Token
    /// [`ChatChunk::Done`]: crate::ChatChunk::Done
    /// [`ChatChunk::Error`]: crate::ChatChunk::Error
    async fn chat_stream(&self, req: ChatRequest) -> Result<BoxStream<ChatChunk>>;
}
