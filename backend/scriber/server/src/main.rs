//! `capsule-server` — HTTP/SSE binary для scriber LLM router.
//!
//! Запускается на `127.0.0.1:8787`. Routes:
//!
//! | Verb     | Path                                              | Что |
//! |----------|---------------------------------------------------|-----|
//! | GET      | `/health`                                         | "ok" |
//! | GET      | `/providers`                                      | список providers + availability |
//! | GET      | `/models`                                         | aggregated по всем available providers |
//! | GET      | `/models/:provider/:name/capabilities`            | capabilities одной модели |
//! | POST     | `/chat/stream`                                    | SSE chat (provider-agnostic) |
//! | POST     | `/conversations`                                  | create |
//! | GET      | `/conversations`                                  | list |
//! | GET/DEL  | `/conversations/:id`                              | get/delete |
//! | POST     | `/conversations/:id/messages`                     | append message |
//! | POST     | `/models/ollama/pull`                             | SSE pull progress |
//! | POST     | `/models/ollama/:name/{load,unload}`              | keep_alive control |
//! | DELETE   | `/models/ollama/:name`                            | delete |

#![forbid(unsafe_code)]

use std::net::SocketAddr;

use axum::{
    routing::{delete, get, post},
    Router,
};
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing::info;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

mod api;
mod error;
mod state;

use state::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    init_tracing();

    let state = AppState::new();
    let app = build_router(state);

    let addr: SocketAddr = "127.0.0.1:8787".parse()?;
    info!(%addr, "scriber server listening");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

fn init_tracing() {
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("warn,capsule_server=info,tower_http=info"));
    tracing_subscriber::registry()
        .with(filter)
        .with(tracing_subscriber::fmt::layer())
        .init();
}

fn build_router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(api::health))
        // Providers + models
        .route("/providers", get(api::providers_list))
        .route("/models", get(api::models_list))
        .route(
            "/models/:provider/:name/capabilities",
            get(api::model_capabilities),
        )
        // Chat
        .route("/chat/stream", post(api::chat_stream))
        // Conversations
        .route("/conversations", post(api::conversation_create))
        .route("/conversations", get(api::conversation_list))
        .route("/conversations/:id", get(api::conversation_get))
        .route("/conversations/:id", delete(api::conversation_delete))
        .route(
            "/conversations/:id/messages",
            post(api::conversation_append),
        )
        // Ollama-specific lifecycle
        .route("/models/ollama/pull", post(api::ollama_pull))
        .route("/models/ollama/:name/load", post(api::ollama_load))
        .route("/models/ollama/:name/unload", post(api::ollama_unload))
        .route("/models/ollama/:name", delete(api::ollama_delete))
        .with_state(state)
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        body::Body,
        http::{Request, StatusCode},
    };
    use capsule_core::{
        BoxStream, Capability, ChatChunk, ChatRequest, Error, LlmBackend, Message, MessageRole,
        ModelInfo, Result,
    };
    use std::sync::Arc;
    use tower::ServiceExt;

    // ─── Health ──────────────────────────────────────────────────────────

    #[tokio::test]
    async fn health_returns_ok() {
        let app = build_router(AppState::new());
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/health")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(resp.into_body(), 64).await.unwrap();
        assert_eq!(&bytes[..], b"ok");
    }

    #[test]
    fn default_state_has_ollama_in_llms() {
        let state = AppState::new();
        assert_eq!(state.llms.len(), 1);
        assert_eq!(state.llms[0].id(), "ollama");
        assert!(state.tools.is_empty());
    }

    // ─── Conversations CRUD ──────────────────────────────────────────────

    #[tokio::test]
    async fn conversations_create_returns_uuid() {
        let app = build_router(AppState::new());
        let resp = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/conversations")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
        let body: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        assert!(body["id"].is_string());
        assert!(body["created_at_ms"].as_u64().unwrap() > 0);
        assert!(body["messages"].as_array().unwrap().is_empty());
    }

    #[tokio::test]
    async fn conversations_list_starts_empty() {
        let app = build_router(AppState::new());
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/conversations")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
        let arr: Vec<serde_json::Value> = serde_json::from_slice(&bytes).unwrap();
        assert!(arr.is_empty());
    }

    #[tokio::test]
    async fn conversation_get_404_for_unknown() {
        let app = build_router(AppState::new());
        let resp = app
            .oneshot(
                Request::builder()
                    .uri(format!("/conversations/{}", uuid::Uuid::new_v4()))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn conversation_create_then_get_returns_record() {
        let app = build_router(AppState::new());

        let create_resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/conversations")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        let bytes = axum::body::to_bytes(create_resp.into_body(), 1024)
            .await
            .unwrap();
        let created: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        let id = created["id"].as_str().unwrap();

        let get_resp = app
            .oneshot(
                Request::builder()
                    .uri(format!("/conversations/{}", id))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(get_resp.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn conversation_delete_removes_it() {
        let app = build_router(AppState::new());

        let create_resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/conversations")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        let bytes = axum::body::to_bytes(create_resp.into_body(), 1024)
            .await
            .unwrap();
        let created: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        let id = created["id"].as_str().unwrap();

        let del_resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri(format!("/conversations/{}", id))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(del_resp.status(), StatusCode::NO_CONTENT);

        let get_resp = app
            .oneshot(
                Request::builder()
                    .uri(format!("/conversations/{}", id))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(get_resp.status(), StatusCode::NOT_FOUND);
    }

    // ─── Chat stream via Mock provider ────────────────────────────────────

    /// Test-double: эмулирует LlmBackend без реального HTTP.
    struct MockLlm;

    #[async_trait::async_trait]
    impl LlmBackend for MockLlm {
        fn id(&self) -> &str {
            "mock"
        }
        async fn available(&self) -> bool {
            true
        }
        async fn list_models(&self) -> Result<Vec<ModelInfo>> {
            Ok(vec![ModelInfo {
                provider: "mock".into(),
                name: "fake".into(),
                capabilities: vec![Capability::Completion],
                size: None,
                family: None,
            }])
        }
        async fn capabilities(&self, _model: &str) -> Result<Vec<Capability>> {
            Ok(vec![Capability::Completion])
        }
        async fn chat_stream(&self, _req: ChatRequest) -> Result<BoxStream<ChatChunk>> {
            let chunks = vec![
                ChatChunk::Token {
                    content: "Hello".into(),
                },
                ChatChunk::Token {
                    content: " world".into(),
                },
                ChatChunk::Done {
                    content: "Hello world".into(),
                    tool_calls: vec![],
                },
            ];
            Ok(Box::pin(futures_util::stream::iter(chunks)))
        }
    }

    /// Test-double: эмулирует LlmBackend который сразу падает (для error-path).
    struct FailingLlm;

    #[async_trait::async_trait]
    impl LlmBackend for FailingLlm {
        fn id(&self) -> &str {
            "failing"
        }
        async fn available(&self) -> bool {
            false
        }
        async fn list_models(&self) -> Result<Vec<ModelInfo>> {
            Err(Error::Transport("nope".into()))
        }
        async fn capabilities(&self, _model: &str) -> Result<Vec<Capability>> {
            Err(Error::NotFound("any".into()))
        }
        async fn chat_stream(&self, _req: ChatRequest) -> Result<BoxStream<ChatChunk>> {
            Err(Error::Transport("simulated transport failure".into()))
        }
    }

    fn build_state_with_mock() -> AppState {
        let mock: Arc<dyn LlmBackend> = Arc::new(MockLlm);
        let failing: Arc<dyn LlmBackend> = Arc::new(FailingLlm);
        let mut state = AppState::new();
        state.llms = Arc::new(vec![mock, failing]);
        state
    }

    #[tokio::test]
    async fn chat_stream_returns_sse_with_token_and_done_events() {
        let app = build_router(build_state_with_mock());
        let body = serde_json::json!({
            "provider": "mock",
            "model": "fake",
            "message": "hi"
        });
        let resp = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/chat/stream")
                    .header("content-type", "application/json")
                    .body(Body::from(body.to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        assert!(resp
            .headers()
            .get("content-type")
            .map(|v| v.to_str().unwrap().contains("text/event-stream"))
            .unwrap_or(false));

        let bytes = axum::body::to_bytes(resp.into_body(), 16 * 1024)
            .await
            .unwrap();
        let text = std::str::from_utf8(&bytes).unwrap();
        assert!(text.contains("event: token"));
        assert!(text.contains("\"content\":\"Hello\""));
        assert!(text.contains("\"content\":\" world\""));
        assert!(text.contains("event: done"));
        assert!(text.contains("\"content\":\"Hello world\""));
    }

    #[tokio::test]
    async fn chat_stream_404_for_unknown_provider() {
        let app = build_router(build_state_with_mock());
        let body = serde_json::json!({
            "provider": "nonexistent",
            "model": "x",
            "message": "hi"
        });
        let resp = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/chat/stream")
                    .header("content-type", "application/json")
                    .body(Body::from(body.to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn chat_stream_502_when_provider_transport_fails() {
        let app = build_router(build_state_with_mock());
        let body = serde_json::json!({
            "provider": "failing",
            "model": "x",
            "message": "hi"
        });
        let resp = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/chat/stream")
                    .header("content-type", "application/json")
                    .body(Body::from(body.to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::BAD_GATEWAY);
    }

    #[tokio::test]
    async fn chat_stream_persists_to_conversation_when_id_given() {
        let app = build_router(build_state_with_mock());

        // Create conversation
        let create_resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/conversations")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        let bytes = axum::body::to_bytes(create_resp.into_body(), 1024)
            .await
            .unwrap();
        let created: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        let id = created["id"].as_str().unwrap().to_string();

        // POST chat with conversation_id
        let body = serde_json::json!({
            "provider": "mock",
            "model": "fake",
            "message": "hi",
            "conversation_id": id
        });
        let chat_resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/chat/stream")
                    .header("content-type", "application/json")
                    .body(Body::from(body.to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(chat_resp.status(), StatusCode::OK);
        // Consume to ensure stream completes (and persistence Done-hook runs).
        let _ = axum::body::to_bytes(chat_resp.into_body(), 16 * 1024)
            .await
            .unwrap();

        // Verify saved messages
        let get_resp = app
            .oneshot(
                Request::builder()
                    .uri(format!("/conversations/{}", id))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        let bytes = axum::body::to_bytes(get_resp.into_body(), 16 * 1024)
            .await
            .unwrap();
        let rec: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        let messages = rec["messages"].as_array().unwrap();
        assert_eq!(messages.len(), 2);
        assert_eq!(messages[0]["role"], "user");
        assert_eq!(messages[0]["content"], "hi");
        assert_eq!(messages[1]["role"], "assistant");
        assert_eq!(messages[1]["content"], "Hello world");
        assert_eq!(rec["provider"], "mock");
        assert_eq!(rec["model"], "fake");
    }

    #[tokio::test]
    async fn chat_stream_404_for_missing_conversation() {
        let app = build_router(build_state_with_mock());
        let body = serde_json::json!({
            "provider": "mock",
            "model": "fake",
            "message": "hi",
            "conversation_id": uuid::Uuid::new_v4().to_string()
        });
        let resp = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/chat/stream")
                    .header("content-type", "application/json")
                    .body(Body::from(body.to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn providers_list_reports_availability() {
        let app = build_router(build_state_with_mock());
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/providers")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(resp.into_body(), 16 * 1024)
            .await
            .unwrap();
        let arr: Vec<serde_json::Value> = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(arr.len(), 2);
        let mock = arr.iter().find(|p| p["id"] == "mock").unwrap();
        assert_eq!(mock["available"], true);
        assert_eq!(mock["models_count"], 1);
        let failing = arr.iter().find(|p| p["id"] == "failing").unwrap();
        assert_eq!(failing["available"], false);
        assert_eq!(failing["models_count"], 0);
    }

    #[tokio::test]
    async fn models_list_skips_unavailable_providers() {
        let app = build_router(build_state_with_mock());
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/models")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(resp.into_body(), 16 * 1024)
            .await
            .unwrap();
        let arr: Vec<serde_json::Value> = serde_json::from_slice(&bytes).unwrap();
        // Только mock available (1 модель), failing — skipped.
        assert_eq!(arr.len(), 1);
        assert_eq!(arr[0]["provider"], "mock");
        assert_eq!(arr[0]["name"], "fake");
    }

    #[tokio::test]
    async fn capabilities_endpoint_returns_provider_response() {
        let app = build_router(build_state_with_mock());
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/models/mock/fake/capabilities")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(resp.into_body(), 1024).await.unwrap();
        let body: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        let caps = body["capabilities"].as_array().unwrap();
        assert!(caps.iter().any(|v| v == "completion"));
    }

    // Suppress unused warning for `Message` import in mock-only paths.
    #[allow(dead_code)]
    fn _force_use_message() -> Message {
        Message {
            role: MessageRole::User,
            content: "x".into(),
            images: None,
            tool_call_id: None,
        }
    }
}
