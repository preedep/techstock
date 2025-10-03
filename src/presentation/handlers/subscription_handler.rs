use actix_web::{web, HttpResponse};
use validator::Validate;
use std::sync::Arc;

use crate::{
    application::{dto::*, services::AppServices},
    domain::{
        entities::{CreateSubscriptionRequest, UpdateSubscriptionRequest},
        value_objects::PaginationParams,
    },
    presentation::responses::{ApiResponse, PaginatedResponse},
    shared::errors::AppResult,
};

pub async fn create_subscription(
    services: web::Data<Arc<AppServices>>,
    dto: web::Json<CreateSubscriptionDto>,
) -> AppResult<HttpResponse> {
    dto.validate().map_err(|e| crate::domain::errors::DomainError::invalid_input(format!("Validation error: {}", e)))?;

    let dto = dto.into_inner();
    let request = CreateSubscriptionRequest {
        name: dto.name,
        tenant_id: dto.tenant_id,
    };

    let subscription = services.subscription_use_cases.create_subscription(request).await?;
    Ok(HttpResponse::Ok().json(ApiResponse::success_with_message(
        subscription,
        "Subscription created successfully".to_string(),
    )))
}

pub async fn get_subscription(
    services: web::Data<Arc<AppServices>>,
    path: web::Path<i64>,
) -> AppResult<HttpResponse> {
    let id = path.into_inner();
    let subscription = services.subscription_use_cases.get_subscription_by_id(id).await?;
    Ok(HttpResponse::Ok().json(ApiResponse::success(subscription)))
}

pub async fn list_subscriptions(
    services: web::Data<Arc<AppServices>>,
    query: web::Query<PaginationQueryDto>,
) -> AppResult<HttpResponse> {
    let query = query.into_inner();
    let pagination = PaginationParams {
        page: query.page,
        size: query.size,
    };

    let (subscriptions, pagination_info) = services
        .subscription_use_cases
        .list_subscriptions(pagination)
        .await?;

    Ok(HttpResponse::Ok().json(PaginatedResponse::new(subscriptions, pagination_info)))
}

pub async fn update_subscription(
    services: web::Data<Arc<AppServices>>,
    path: web::Path<i64>,
    dto: web::Json<UpdateSubscriptionDto>,
) -> AppResult<HttpResponse> {
    let id = path.into_inner();
    dto.validate().map_err(|e| crate::domain::errors::DomainError::invalid_input(format!("Validation error: {}", e)))?;

    let dto = dto.into_inner();
    let request = UpdateSubscriptionRequest {
        name: dto.name,
        tenant_id: dto.tenant_id,
    };

    let subscription = services.subscription_use_cases.update_subscription(id, request).await?;
    Ok(HttpResponse::Ok().json(ApiResponse::success_with_message(
        subscription,
        "Subscription updated successfully".to_string(),
    )))
}

pub async fn delete_subscription(
    services: web::Data<Arc<AppServices>>,
    path: web::Path<i64>,
) -> AppResult<HttpResponse> {
    let id = path.into_inner();
    services.subscription_use_cases.delete_subscription(id).await?;
    Ok(HttpResponse::NoContent().finish())
}
