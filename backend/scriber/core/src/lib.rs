//! Core traits and types for the scriber LLM router.
//!
//! `capsule-core` defines provider-agnostic abstractions:
//! - [`LlmBackend`] — trait для LLM провайдеров (Ollama, OpenAI, Anthropic, Gemini)
//! - [`ToolProvider`] — trait для источников tools (native FS, MCP servers)
//!
//! Конкретные реализации — в `capsule-ollama`, `capsule-mcp`, `capsule-native-tools`.

#![forbid(unsafe_code)]
#![warn(missing_docs)]

mod backend;
mod error;
mod tools;
mod types;

pub use backend::LlmBackend;
pub use error::{Error, Result};
pub use tools::ToolProvider;
pub use types::{
    Capability, ChatChunk, ChatRequest, Message, MessageRole, ModelInfo, ToolCall, ToolDef,
};

/// Boxed Stream alias для return-position async streams в traits.
pub type BoxStream<T> = futures_util::stream::BoxStream<'static, T>;
