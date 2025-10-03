use actix_web::{web, HttpResponse};
use validator::Validate;
use std::sync::Arc;

use crate::{
    application::{dto::*, services::AppServices, use_cases::ResourceStatistics},
    domain::{
        entities::{CreateResourceRequest, UpdateResourceRequest},
        value_objects::{PaginationParams, ResourceFilters, SortParams, SortDirection},
    },
    presentation::responses::{ApiResponse, PaginatedResponse},
    shared::errors::AppResult,
};

pub async fn create_resource(
    services: web::Data<Arc<AppServices>>,
    dto: web::Json<CreateResourceDto>,
) -> AppResult<HttpResponse> {
    dto.validate().map_err(|e| crate::domain::errors::DomainError::invalid_input(format!("Validation error: {}", e)))?;

    let dto = dto.into_inner();
    let request = CreateResourceRequest {
        azure_id: None,
        name: dto.name,
        resource_type: dto.resource_type,
        kind: dto.kind,
        location: dto.location,
        subscription_id: dto.subscription_id,
        resource_group_id: dto.resource_group_id,
        tags: dto.tags.unwrap_or_else(|| std::collections::HashMap::new()),
        extended_location: dto.extended_location,
        vendor: dto.vendor,
        environment: dto.environment,
        provisioner: dto.provisioner,
    };

    let resource = services.resource_use_cases.create_resource(request).await?;
    Ok(HttpResponse::Ok().json(ApiResponse::success_with_message(
        resource,
        "Resource created successfully".to_string(),
    )))
}

pub async fn get_resource(
    services: web::Data<Arc<AppServices>>,
    path: web::Path<i64>,
) -> AppResult<HttpResponse> {
    let id = path.into_inner();
    let resource = services.resource_use_cases.get_resource_by_id(id).await?;
    Ok(HttpResponse::Ok().json(ApiResponse::success(resource)))
}

pub async fn list_resources(
    services: web::Data<Arc<AppServices>>,
    query: web::Query<ResourceQueryDto>,
) -> AppResult<HttpResponse> {
    let query = query.into_inner();
    let pagination = PaginationParams {
        page: query.page,
        size: query.size,
    };

    let filters = ResourceFilters {
        resource_type: query.resource_type,
        location: query.location,
        environment: query.environment,
        vendor: query.vendor,
        subscription_id: query.subscription_id,
        resource_group_id: query.resource_group_id,
        search: query.search,
        tags: query.tags,
    };

    let sort = SortParams {
        field: query.sort_field,
        direction: query.sort_direction.and_then(|d| match d.as_str() {
            "desc" => Some(SortDirection::Descending),
            _ => Some(SortDirection::Ascending),
        }),
    };

    let (resources, pagination_info) = services
        .resource_use_cases
        .list_resources(pagination, filters, sort)
        .await?;

    Ok(HttpResponse::Ok().json(PaginatedResponse::new(resources, pagination_info)))
}

pub async fn update_resource(
    services: web::Data<Arc<AppServices>>,
    path: web::Path<i64>,
    dto: web::Json<UpdateResourceDto>,
) -> AppResult<HttpResponse> {
    let id = path.into_inner();
    dto.validate().map_err(|e| crate::domain::errors::DomainError::invalid_input(format!("Validation error: {}", e)))?;

    let dto = dto.into_inner();
    let request = UpdateResourceRequest {
        azure_id: None,
        name: dto.name,
        resource_type: dto.resource_type,
        kind: dto.kind,
        location: dto.location,
        subscription_id: dto.subscription_id,
        resource_group_id: dto.resource_group_id,
        tags: dto.tags,
        extended_location: dto.extended_location,
        vendor: dto.vendor,
        environment: dto.environment,
        provisioner: dto.provisioner,
    };

    let resource = services.resource_use_cases.update_resource(id, request).await?;
    Ok(HttpResponse::Ok().json(ApiResponse::success_with_message(
        resource,
        "Resource updated successfully".to_string(),
    )))
}

pub async fn delete_resource(
    services: web::Data<Arc<AppServices>>,
    path: web::Path<i64>,
) -> AppResult<HttpResponse> {
    let id = path.into_inner();
    services.resource_use_cases.delete_resource(id).await?;
    Ok(HttpResponse::NoContent().finish())
}

pub async fn get_resource_statistics(
    services: web::Data<Arc<AppServices>>,
) -> AppResult<HttpResponse> {
    let stats = services.resource_use_cases.get_resource_statistics().await?;
    Ok(HttpResponse::Ok().json(ApiResponse::success(stats)))
}

pub async fn get_resources_by_subscription(
    services: web::Data<Arc<AppServices>>,
    path: web::Path<i64>,
) -> AppResult<HttpResponse> {
    let subscription_id = path.into_inner();
    let resources = services
        .resource_use_cases
        .get_resources_by_subscription(subscription_id)
        .await?;
    Ok(HttpResponse::Ok().json(ApiResponse::success(resources)))
}

pub async fn get_resource_types(
    services: web::Data<Arc<AppServices>>,
) -> AppResult<HttpResponse> {
    let types = services.resource_use_cases.get_distinct_resource_types().await?;
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "success": true,
        "data": types,
        "message": null
    })))
}
