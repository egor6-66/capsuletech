//! MCP (Model Context Protocol) implementation of [`capsule_core::ToolProvider`].
//!
//! **Status**: scaffold (PR-1). Full implementation в P1.
//!
//! Будет JSON-RPC клиент к external MCP server'ам (stdio + HTTP transports).
//! Спецификация — <https://spec.modelcontextprotocol.io/>.

#![forbid(unsafe_code)]
#![warn(missing_docs)]

use async_trait::async_trait;
use capsule_core::{Error, Result, ToolDef, ToolProvider};

/// MCP-client tool-провайдер.
///
/// Подключается к external MCP server (stdio process или HTTP endpoint),
/// проксирует `tools/list` / `tools/call` через JSON-RPC.
///
/// **PR-1**: только конструктор + id. Trait methods возвращают `not implemented`.
pub struct MCPToolProvider {
    id: String,
}

impl MCPToolProvider {
    /// Создать provider с заданным ID. В P1 — дополнительные конструкторы
    /// для stdio (`from_stdio(command)`) / HTTP (`from_http(url)`) transports.
    pub fn new(id: impl Into<String>) -> Self {
        Self { id: id.into() }
    }
}

#[async_trait]
impl ToolProvider for MCPToolProvider {
    fn id(&self) -> &str {
        &self.id
    }

    async fn list_tools(&self) -> Result<Vec<ToolDef>> {
        Err(Error::Other(format!(
            "MCPToolProvider({})::list_tools — not implemented (P1)",
            self.id
        )))
    }

    async fn dispatch(&self, _name: &str, _args: serde_json::Value) -> Result<String> {
        Err(Error::Other(format!(
            "MCPToolProvider({})::dispatch — not implemented (P1)",
            self.id
        )))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn id_is_preserved() {
        let p = MCPToolProvider::new("mcp:github");
        assert_eq!(p.id(), "mcp:github");
    }
}
