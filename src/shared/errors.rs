use actix_web::{
    http::StatusCode,
    HttpResponse, ResponseError,
};
use serde_json::json;
use std::fmt;
use crate::domain::errors::DomainError;

#[derive(Debug)]
pub struct AppError(pub DomainError);

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl ResponseError for AppError {
    fn status_code(&self) -> StatusCode {
        match self.0 {
            DomainError::NotFound { .. } => StatusCode::NOT_FOUND,
            DomainError::AlreadyExists { .. } => StatusCode::CONFLICT,
            DomainError::InvalidInput { .. } => StatusCode::BAD_REQUEST,
            DomainError::BusinessRuleViolation { .. } => StatusCode::UNPROCESSABLE_ENTITY,
            DomainError::DatabaseError { .. } => StatusCode::INTERNAL_SERVER_ERROR,
            DomainError::InternalError { .. } => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    fn error_response(&self) -> HttpResponse {
        let status = self.status_code();
        let error_message = match self.0 {
            DomainError::DatabaseError { .. } => "Database error occurred".to_string(),
            DomainError::InternalError { .. } => "Internal server error".to_string(),
            _ => self.0.to_string(),
        };

        HttpResponse::build(status).json(json!({
            "error": error_message,
            "status": status.as_u16()
        }))
    }
}

impl From<DomainError> for AppError {
    fn from(err: DomainError) -> Self {
        Self(err)
    }
}

pub type AppResult<T> = Result<T, AppError>;
