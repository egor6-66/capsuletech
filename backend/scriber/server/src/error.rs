//! HTTP-level error type + mapping из `capsule_core::Error`.

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;

/// Error type для axum-handler'ов.
///
/// Маппинг `capsule_core::Error` → HTTP status:
/// - `Transport` → 502 Bad Gateway (daemon упал)
/// - `Provider { status, .. }` → пробрасываем статус если разумный, иначе 502
/// - `NotFound` → 404
/// - `BadRequest` → 400
/// - `Serde` → 400 (невалидный JSON в запросе или ответе)
/// - `Other` → 500
#[derive(Debug)]
pub enum AppError {
    BadRequest(String),
    NotFound(String),
    BadGateway(String),
    Provider { status: u16, message: String },
    Internal(String),
}

impl From<capsule_core::Error> for AppError {
    fn from(e: capsule_core::Error) -> Self {
        use capsule_core::Error;
        match e {
            Error::Transport(m) => AppError::BadGateway(m),
            Error::Provider { status, message } => AppError::Provider { status, message },
            Error::NotFound(m) => AppError::NotFound(m),
            Error::BadRequest(m) => AppError::BadRequest(m),
            Error::Serde(e) => AppError::BadRequest(e.to_string()),
            Error::Other(m) => AppError::Internal(m),
        }
    }
}

#[derive(Serialize)]
struct ErrorBody {
    error: String,
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            AppError::BadRequest(m) => (StatusCode::BAD_REQUEST, m),
            AppError::NotFound(m) => (StatusCode::NOT_FOUND, m),
            AppError::BadGateway(m) => (StatusCode::BAD_GATEWAY, m),
            AppError::Provider { status, message } => {
                let code = StatusCode::from_u16(status).unwrap_or(StatusCode::BAD_GATEWAY);
                (code, message)
            }
            AppError::Internal(m) => (StatusCode::INTERNAL_SERVER_ERROR, m),
        };
        (status, Json(ErrorBody { error: message })).into_response()
    }
}
