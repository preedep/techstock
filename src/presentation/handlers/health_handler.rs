use actix_web::{web, HttpResponse};
use chrono::Utc;
use std::sync::Arc;

use crate::{
    infrastructure::database::Database,
    presentation::responses::{ApiResponse, HealthResponse, StatsResponse},
    shared::errors::AppResult,
};

pub async fn health_check(
    database: web::Data<Arc<Database>>,
) -> AppResult<HttpResponse> {
    // Check database connectivity
    database.health_check().await?;

    let response = HealthResponse {
        status: "healthy".to_string(),
        timestamp: Utc::now().to_rfc3339(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    };

    Ok(HttpResponse::Ok().json(ApiResponse::success(response)))
}

pub async fn get_stats(
    database: web::Data<Arc<Database>>,
) -> AppResult<HttpResponse> {
    let total_resources = database.get_total_count("resource").await?;
    let total_subscriptions = database.get_total_count("subscription").await?;
    let total_resource_groups = database.get_total_count("resource_group").await?;
    let total_applications = database.get_total_count("application").await?;

    let stats = StatsResponse {
        total_resources,
        total_subscriptions,
        total_resource_groups,
        total_applications,
    };

    Ok(HttpResponse::Ok().json(ApiResponse::success(stats)))
}
