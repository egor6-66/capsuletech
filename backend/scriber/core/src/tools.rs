//! Trait [`ToolProvider`] — провайдер-агностичный источник tools.

use async_trait::async_trait;

use crate::{error::Result, types::ToolDef};

/// Источник tools для агентов.
///
/// Реализации:
/// - (P1) `capsule_native_tools::NativeToolProvider` — встроенные FS-tools через `capsule_fs`
/// - (P1) `capsule_mcp::MCPToolProvider` — MCP-protocol JSON-RPC клиент
///
/// Tools-провайдеры регистрируются в server'е; конкретный набор tools
/// доступных конкретному агенту определяется per-agent whitelist'ом.
#[async_trait]
pub trait ToolProvider: Send + Sync {
    /// Уникальный ID провайдера (`"native"`, `"mcp:github"`, ...).
    fn id(&self) -> &str;

    /// Список tools предоставляемых провайдером.
    async fn list_tools(&self) -> Result<Vec<ToolDef>>;

    /// Выполнить tool с аргументами.
    ///
    /// Возвращает stringified result (модель видит как `role=tool` message content).
    /// Формат — JSON-stringified value или plain text (зависит от tool'а).
    async fn dispatch(&self, name: &str, args: serde_json::Value) -> Result<String>;
}
