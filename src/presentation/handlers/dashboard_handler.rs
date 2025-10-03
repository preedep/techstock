use actix_web::{web, HttpResponse};
use std::sync::Arc;
use crate::{
    application::{dto::*, services::AppServices},
    presentation::responses::ApiResponse,
    shared::errors::AppResult,
};

pub async fn get_dashboard_summary(
    services: web::Data<Arc<AppServices>>,
    query: web::Query<DashboardFiltersDto>,
) -> AppResult<HttpResponse> {
    let filters = query.into_inner();
    
    // Convert empty strings to None for proper filtering
    let cleaned_filters = DashboardFiltersDto {
        subscription_id: filters.subscription_id,
        resource_group_id: filters.resource_group_id,
        location: if filters.location.as_ref().map_or(true, |s| s.is_empty()) {
            None
        } else {
            filters.location
        },
        environment: if filters.environment.as_ref().map_or(true, |s| s.is_empty()) {
            None
        } else {
            filters.environment
        },
        time_range: if filters.time_range.as_ref().map_or(true, |s| s.is_empty()) {
            None
        } else {
            filters.time_range
        },
    };

    let summary = services
        .dashboard_use_cases
        .get_dashboard_summary(Some(cleaned_filters))
        .await?;

    Ok(HttpResponse::Ok().json(ApiResponse::success(summary)))
}

pub async fn get_dashboard_summary_no_filters(
    services: web::Data<Arc<AppServices>>,
) -> AppResult<HttpResponse> {
    let summary = services
        .dashboard_use_cases
        .get_dashboard_summary(None)
        .await?;

    Ok(HttpResponse::Ok().json(ApiResponse::success(summary)))
}
