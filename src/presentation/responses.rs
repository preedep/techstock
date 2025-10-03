use serde::{Deserialize, Serialize};
use crate::domain::value_objects::Pagination;

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub data: T,
    pub success: bool,
    pub message: Option<String>,
}

impl<T> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            data,
            success: true,
            message: None,
        }
    }

    pub fn success_with_message(data: T, message: String) -> Self {
        Self {
            data,
            success: true,
            message: Some(message),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PaginatedResponse<T> {
    pub data: Vec<T>,
    pub pagination: Pagination,
    pub success: bool,
}

impl<T> PaginatedResponse<T> {
    pub fn new(data: Vec<T>, pagination: Pagination) -> Self {
        Self {
            data,
            pagination,
            success: true,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HealthResponse {
    pub status: String,
    pub timestamp: String,
    pub version: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StatsResponse {
    pub total_resources: i64,
    pub total_subscriptions: i64,
    pub total_resource_groups: i64,
    pub total_applications: i64,
}
