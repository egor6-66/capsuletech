//! Общий error type для traits и реализаций.

use thiserror::Error;

/// Ошибки, общие для всех провайдеров.
#[derive(Debug, Error)]
pub enum Error {
    /// Транспорт сломан (HTTP / WS / stdio).
    #[error("transport error: {0}")]
    Transport(String),

    /// Provider ответил ошибкой (не-2xx HTTP, JSON-RPC error).
    #[error("provider error ({status}): {message}")]
    Provider {
        /// HTTP status или код провайдера.
        status: u16,
        /// Человекочитаемое сообщение.
        message: String,
    },

    /// Запрошенная модель / tool / conversation не найдена.
    #[error("not found: {0}")]
    NotFound(String),

    /// Невалидный запрос (схема, отсутствуют поля, неверный формат).
    #[error("bad request: {0}")]
    BadRequest(String),

    /// Сериализация / десериализация JSON.
    #[error("serde: {0}")]
    Serde(#[from] serde_json::Error),

    /// Прочее, не классифицировано.
    #[error("other: {0}")]
    Other(String),
}

/// Удобный alias для `Result<T, Error>`.
pub type Result<T> = std::result::Result<T, Error>;
