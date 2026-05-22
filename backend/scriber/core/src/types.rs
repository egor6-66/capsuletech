//! Общие типы для запросов и ответов.

use serde::{Deserialize, Serialize};

/// Роль сообщения в чате.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MessageRole {
    /// Системная инструкция.
    System,
    /// Сообщение от пользователя.
    User,
    /// Ответ модели.
    Assistant,
    /// Результат tool dispatch.
    Tool,
}

/// Одно сообщение в conversation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    /// Роль автора сообщения.
    pub role: MessageRole,
    /// Текстовый контент.
    pub content: String,
    /// Опциональные изображения (base64), для vision-моделей.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub images: Option<Vec<String>>,
    /// ID tool_call (если role=tool, ссылка на запросивший call).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
}

/// Capability модели — что она умеет.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum Capability {
    /// Базовый text completion.
    Completion,
    /// Native tools API (function calling).
    Tools,
    /// Vision — модель умеет читать images.
    Vision,
    /// Embeddings — выдаёт vector representations.
    Embedding,
}

/// Метаданные модели для UI.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    /// ID provider'а (`"ollama"`, `"openai"`, ...).
    pub provider: String,
    /// Имя модели в формате provider'а.
    pub name: String,
    /// Список capabilities.
    #[serde(default)]
    pub capabilities: Vec<Capability>,
    /// Размер в байтах (если известен; для downloaded моделей).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub size: Option<u64>,
    /// Семейство (`"llama"`, `"qwen"`, ...).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub family: Option<String>,
}

/// Спецификация tool'а — описание для модели и для UI.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolDef {
    /// Уникальное имя.
    pub name: String,
    /// Человекочитаемое описание (модель видит).
    pub description: String,
    /// JSON Schema для параметров.
    pub parameters: serde_json::Value,
}

/// Запрос модели на вызов tool'а.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    /// ID call'а (для сопоставления с result).
    pub id: String,
    /// Имя tool'а.
    pub name: String,
    /// Аргументы как JSON.
    pub arguments: serde_json::Value,
}

/// Запрос на chat streaming.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatRequest {
    /// ID provider'а.
    pub provider: String,
    /// Имя модели.
    pub model: String,
    /// История сообщений (включая system если хочется явно).
    pub messages: Vec<Message>,
    /// Опциональный system prompt (если не в `messages`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub system: Option<String>,
    /// Разрешить ли модели использовать tools.
    ///
    /// Default `false` — модель просто отвечает текстом.
    /// Если `true` но `capabilities(model)` не содержит [`Capability::Tools`],
    /// бэк должен gracefully игнорировать (просто эмиттит токены без tool-loop).
    #[serde(default)]
    pub enable_tools: bool,
    /// Список tools (если `enable_tools=true`).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tools: Vec<ToolDef>,
    /// Опциональная температура (provider-specific).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
}

/// Событие streaming-ответа.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ChatChunk {
    /// Текстовый delta (часть ответа).
    Token {
        /// Кусок текста.
        content: String,
    },
    /// Модель попросила вызов tool'а.
    ToolCall {
        /// Тело call'а.
        call: ToolCall,
    },
    /// Streaming завершён успешно.
    Done {
        /// Финальный assistant content (накопленный).
        content: String,
        /// Tool calls (если есть).
        #[serde(default, skip_serializing_if = "Vec::is_empty")]
        tool_calls: Vec<ToolCall>,
    },
    /// Ошибка во время streaming'а.
    Error {
        /// Сообщение.
        message: String,
    },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn message_serde_roundtrip() {
        let m = Message {
            role: MessageRole::User,
            content: "hello".into(),
            images: None,
            tool_call_id: None,
        };
        let json = serde_json::to_string(&m).unwrap();
        let back: Message = serde_json::from_str(&json).unwrap();
        assert_eq!(back.content, "hello");
        assert_eq!(back.role, MessageRole::User);
    }

    #[test]
    fn message_with_images_serializes() {
        let m = Message {
            role: MessageRole::User,
            content: "describe".into(),
            images: Some(vec!["base64data".into()]),
            tool_call_id: None,
        };
        let json = serde_json::to_string(&m).unwrap();
        assert!(json.contains("\"images\""));
    }

    #[test]
    fn message_without_images_omits_field() {
        let m = Message {
            role: MessageRole::User,
            content: "plain".into(),
            images: None,
            tool_call_id: None,
        };
        let json = serde_json::to_string(&m).unwrap();
        assert!(!json.contains("images"));
        assert!(!json.contains("tool_call_id"));
    }

    #[test]
    fn capability_lowercase_serde() {
        let json = serde_json::to_string(&Capability::Tools).unwrap();
        assert_eq!(json, "\"tools\"");
        let v: Capability = serde_json::from_str("\"vision\"").unwrap();
        assert_eq!(v, Capability::Vision);
    }

    #[test]
    fn chat_chunk_token_serializes_as_tagged_union() {
        let chunk = ChatChunk::Token {
            content: "hi".into(),
        };
        let json = serde_json::to_string(&chunk).unwrap();
        assert!(json.contains("\"type\":\"token\""));
        assert!(json.contains("\"content\":\"hi\""));
    }

    #[test]
    fn chat_chunk_done_with_tool_calls() {
        let chunk = ChatChunk::Done {
            content: "ok".into(),
            tool_calls: vec![ToolCall {
                id: "1".into(),
                name: "read_file".into(),
                arguments: serde_json::json!({"path": "foo"}),
            }],
        };
        let json = serde_json::to_string(&chunk).unwrap();
        assert!(json.contains("\"type\":\"done\""));
        assert!(json.contains("\"name\":\"read_file\""));
    }

    #[test]
    fn chat_request_defaults_enable_tools_false() {
        let req: ChatRequest = serde_json::from_str(
            r#"{"provider":"ollama","model":"llama3","messages":[]}"#,
        )
        .unwrap();
        assert!(!req.enable_tools);
        assert!(req.tools.is_empty());
        assert!(req.system.is_none());
    }

    #[test]
    fn model_info_capabilities_default_empty() {
        let info: ModelInfo = serde_json::from_str(
            r#"{"provider":"ollama","name":"llama3"}"#,
        )
        .unwrap();
        assert!(info.capabilities.is_empty());
    }
}
