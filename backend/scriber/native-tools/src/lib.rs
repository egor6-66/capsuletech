//! Native FS tool-провайдер (`read_file`, `write_file`, `apply_diff`, ...).
//!
//! **Status**: scaffold (PR-1). Full implementation в P1.
//!
//! Использует [`capsule_fs::Workspace`] для FS operations c sandboxing'ом
//! через `write_scope`. В P1 заменит legacy `capsule-tools` crate.
//!
//! Tools (планируемые): `read_file`, `list_dir`, `write_file`, `apply_diff`,
//! `create_dir`, `grep`.

#![forbid(unsafe_code)]
#![warn(missing_docs)]

use async_trait::async_trait;
use capsule_core::{Error, Result, ToolDef, ToolProvider};

/// Tool-провайдер с встроенными FS-операциями.
///
/// **PR-1**: только конструктор + id. Trait methods возвращают `not implemented`.
pub struct NativeToolProvider {
    workspace_root: std::path::PathBuf,
}

impl NativeToolProvider {
    /// Создать провайдер с заданным workspace root.
    /// В P1 — добавится `write_scope: Option<PathBuf>` для sandbox'инга `write_file`/`apply_diff`/`create_dir`.
    pub fn new(workspace_root: impl Into<std::path::PathBuf>) -> Self {
        Self {
            workspace_root: workspace_root.into(),
        }
    }

    /// Workspace root (для диагностики).
    pub fn workspace_root(&self) -> &std::path::Path {
        &self.workspace_root
    }
}

#[async_trait]
impl ToolProvider for NativeToolProvider {
    fn id(&self) -> &str {
        "native"
    }

    async fn list_tools(&self) -> Result<Vec<ToolDef>> {
        Err(Error::Other(
            "NativeToolProvider::list_tools — not implemented (P1)".into(),
        ))
    }

    async fn dispatch(&self, _name: &str, _args: serde_json::Value) -> Result<String> {
        Err(Error::Other(
            "NativeToolProvider::dispatch — not implemented (P1)".into(),
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn id_is_native() {
        let p = NativeToolProvider::new("/tmp");
        assert_eq!(p.id(), "native");
    }

    #[test]
    fn workspace_root_is_preserved() {
        let p = NativeToolProvider::new("/some/path");
        assert_eq!(p.workspace_root(), PathBuf::from("/some/path").as_path());
    }
}
