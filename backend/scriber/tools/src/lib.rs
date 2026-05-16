use capsule_fs::Workspace;
use capsule_ollama::{Tool, ToolDef};
use serde_json::{json, Value};

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("unknown tool: {0}")]
    Unknown(String),
    #[error("invalid arguments: {0}")]
    BadArgs(String),
    #[error(transparent)]
    Fs(#[from] capsule_fs::Error),
    #[error("json: {0}")]
    Json(#[from] serde_json::Error),
}

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Clone)]
pub struct ToolKit {
    workspace: Workspace,
}

impl ToolKit {
    pub fn new(workspace: Workspace) -> Self {
        Self { workspace }
    }

    /// Render tool descriptions as a markdown block suitable for injection
    /// into a system prompt when the native Ollama tools API is not used
    /// (raw mode for models like the qwen2.5-coder family).
    pub fn descriptions_as_markdown(&self) -> String {
        let mut out = String::from(
            "# Tools\n\n\
             You have these tools available. To call one, emit a single fenced JSON \
             block at the END of your reply, exactly in this shape:\n\n\
             ```json\n\
             {\"name\": \"<tool>\", \"arguments\": { ... }}\n\
             ```\n\n\
             Rules:\n\
             - The fence MUST be ```json ... ``` (lowercase `json`).\n\
             - The object MUST have `name` (string) and `arguments` (object).\n\
             - Emit AT MOST ONE tool call per reply. Wait for the result before calling another.\n\
             - When you have nothing more to do, reply with prose and NO fenced JSON block.\n\n\
             ## Available tools\n\n",
        );
        for tool in self.descriptions() {
            out.push_str(&format!(
                "### `{name}`\n{desc}\n\nArguments schema:\n```json\n{schema}\n```\n\n",
                name = tool.function.name,
                desc = tool.function.description,
                schema = serde_json::to_string_pretty(&tool.function.parameters).unwrap_or_default(),
            ));
        }
        out
    }

    pub fn descriptions(&self) -> Vec<Tool> {
        vec![
            Tool {
                kind: "function",
                function: ToolDef {
                    name: "read_file".into(),
                    description: "Read the contents of a UTF-8 text file from the project workspace. \
                        Always call this before answering questions that require seeing file contents."
                        .into(),
                    parameters: json!({
                        "type": "object",
                        "properties": {
                            "path": {
                                "type": "string",
                                "description": "File path relative to the workspace root using forward slashes. \
                                    Absolute paths and `..` traversal are rejected."
                            }
                        },
                        "required": ["path"]
                    }),
                },
            },
            Tool {
                kind: "function",
                function: ToolDef {
                    name: "list_dir".into(),
                    description: "List the immediate entries of a directory in the project workspace. \
                        Use this to discover what files and subdirectories exist before deciding which file to read. \
                        Returns files and directories (one level deep); common noise like .git/target/node_modules is skipped."
                        .into(),
                    parameters: json!({
                        "type": "object",
                        "properties": {
                            "path": {
                                "type": "string",
                                "description": "Directory path relative to the workspace root using forward slashes. \
                                    Use \".\" or an empty string for the workspace root."
                            }
                        },
                        "required": ["path"]
                    }),
                },
            },
            Tool {
                kind: "function",
                function: ToolDef {
                    name: "write_file".into(),
                    description: "Create or overwrite a UTF-8 text file inside the project's write scope. \
                        Use this to materialize generated code. Returns whether the file was created or replaced. \
                        Pass overwrite=true to replace an existing file (default false to prevent accidents)."
                        .into(),
                    parameters: json!({
                        "type": "object",
                        "properties": {
                            "path": {
                                "type": "string",
                                "description": "Target file path relative to the workspace root, forward slashes. \
                                    Must be inside the active write scope, otherwise the call is rejected."
                            },
                            "content": {
                                "type": "string",
                                "description": "Full UTF-8 content to write."
                            },
                            "overwrite": {
                                "type": "boolean",
                                "description": "If true, replaces an existing file. Defaults to false."
                            }
                        },
                        "required": ["path", "content"]
                    }),
                },
            },
            Tool {
                kind: "function",
                function: ToolDef {
                    name: "apply_diff".into(),
                    description: "Apply one or more surgical SEARCH/REPLACE edits to an existing file. \
                        Much cheaper than rewriting the whole file via write_file when you only need \
                        targeted fixes. Each block's `search` MUST match exactly once in the current \
                        file contents — if it matches zero or multiple times, the WHOLE diff is \
                        rejected and the file is left untouched. Blocks are applied sequentially to \
                        the running file content."
                        .into(),
                    parameters: json!({
                        "type": "object",
                        "properties": {
                            "path": {
                                "type": "string",
                                "description": "File path relative to workspace root (must be inside write scope)."
                            },
                            "blocks": {
                                "type": "array",
                                "description": "Ordered list of SEARCH/REPLACE blocks to apply. Each block: `search` (exact substring to find — include enough surrounding context to be unique) and `replace` (what to put in its place; use empty string to delete).",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "search": { "type": "string" },
                                        "replace": { "type": "string" }
                                    },
                                    "required": ["search", "replace"]
                                },
                                "minItems": 1
                            }
                        },
                        "required": ["path", "blocks"]
                    }),
                },
            },
            Tool {
                kind: "function",
                function: ToolDef {
                    name: "create_dir".into(),
                    description: "Create a directory (recursively) inside the project's write scope. \
                        Safe to call on an existing directory — returns created=false in that case."
                        .into(),
                    parameters: json!({
                        "type": "object",
                        "properties": {
                            "path": {
                                "type": "string",
                                "description": "Directory path relative to the workspace root, forward slashes. \
                                    Must be inside the active write scope."
                            }
                        },
                        "required": ["path"]
                    }),
                },
            },
            Tool {
                kind: "function",
                function: ToolDef {
                    name: "grep".into(),
                    description: "Search the project workspace for a regex pattern (Rust regex syntax, also accepted by ripgrep). \
                        Returns up to `max_matches` matching lines, each with file path and 1-based line number. \
                        Use this to locate symbols, definitions, or usages before reading whole files."
                        .into(),
                    parameters: json!({
                        "type": "object",
                        "properties": {
                            "pattern": {
                                "type": "string",
                                "description": "Regex pattern to search for."
                            },
                            "path": {
                                "type": "string",
                                "description": "Optional path to limit the search (relative to workspace root). \
                                    Defaults to the whole workspace if omitted."
                            },
                            "max_matches": {
                                "type": "integer",
                                "description": "Maximum number of matches to return. Defaults to 100, capped at 500."
                            }
                        },
                        "required": ["pattern"]
                    }),
                },
            },
        ]
    }

    pub async fn dispatch(&self, name: &str, args: &Value) -> Result<String> {
        let args = normalize_args(args)?;
        match name {
            "read_file" => {
                let path = args
                    .get("path")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| Error::BadArgs("expected `path: string`".into()))?;
                let res = self.workspace.read_text(path).await?;
                let content = truncate_utf8(&res.content, 16_000);
                Ok(serde_json::to_string(&json!({
                    "path": res.path,
                    "bytes": res.bytes,
                    "content": content,
                }))?)
            }
            "write_file" => {
                let path = args
                    .get("path")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| Error::BadArgs("expected `path: string`".into()))?;
                let content = args
                    .get("content")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| Error::BadArgs("expected `content: string`".into()))?;
                let overwrite = args
                    .get("overwrite")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false);
                let res = self.workspace.write_text(path, content, overwrite).await?;
                Ok(serde_json::to_string(&res)?)
            }
            "apply_diff" => {
                let path = args
                    .get("path")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| Error::BadArgs("expected `path: string`".into()))?;
                let blocks_val = args
                    .get("blocks")
                    .ok_or_else(|| Error::BadArgs("expected `blocks: array`".into()))?;
                let blocks: Vec<capsule_fs::DiffBlock> = serde_json::from_value(blocks_val.clone())
                    .map_err(|e| Error::BadArgs(format!("invalid blocks: {}", e)))?;
                let res = self.workspace.apply_diff(path, &blocks).await?;
                Ok(serde_json::to_string(&res)?)
            }
            "create_dir" => {
                let path = args
                    .get("path")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| Error::BadArgs("expected `path: string`".into()))?;
                let res = self.workspace.create_dir(path).await?;
                Ok(serde_json::to_string(&res)?)
            }
            "list_dir" => {
                let path = args
                    .get("path")
                    .and_then(|v| v.as_str())
                    .unwrap_or(".");
                let res = self.workspace.list_dir(path, 500).await?;
                Ok(serde_json::to_string(&res)?)
            }
            "grep" => {
                let pattern = args
                    .get("pattern")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| Error::BadArgs("expected `pattern: string`".into()))?;
                let path = args.get("path").and_then(|v| v.as_str());
                let max_matches = args
                    .get("max_matches")
                    .and_then(coerce_u64)
                    .map(|n| n.min(500) as usize)
                    .unwrap_or(100);
                let res = self.workspace.grep(pattern, path, max_matches).await?;
                Ok(serde_json::to_string(&res)?)
            }
            _ => Err(Error::Unknown(name.into())),
        }
    }
}

fn coerce_u64(v: &Value) -> Option<u64> {
    v.as_u64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))
}

fn normalize_args(v: &Value) -> Result<Value> {
    match v {
        Value::String(s) => Ok(serde_json::from_str(s)?),
        Value::Object(_) | Value::Null => Ok(v.clone()),
        _ => Err(Error::BadArgs("expected object or json-string".into())),
    }
}

fn truncate_utf8(s: &str, max: usize) -> String {
    if s.len() <= max {
        return s.to_string();
    }
    let mut end = max;
    while end > 0 && !s.is_char_boundary(end) {
        end -= 1;
    }
    let mut out = s[..end].to_string();
    out.push_str("\n... [truncated]");
    out
}
