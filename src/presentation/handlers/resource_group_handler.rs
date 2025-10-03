use actix_web::{web, HttpResponse};
use std::sync::Arc;

use crate::{
    application::services::AppServices,
    shared::errors::AppResult,
};

pub async fn get_resource_groups(
    services: web::Data<Arc<AppServices>>,
) -> AppResult<HttpResponse> {
    // Get all resource groups from the repository
    let resource_groups = services.resource_group_use_cases.list_all().await?;
    
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "success": true,
        "data": resource_groups,
        "message": null
    })))
}

pub async fn get_resource_group_by_id(
    path: web::Path<i64>,
    services: web::Data<Arc<AppServices>>,
) -> AppResult<HttpResponse> {
    let resource_group_id = path.into_inner();
    
    let resource_group = services.resource_group_use_cases.get_resource_group_by_id(resource_group_id).await?;
    
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "success": true,
        "data": resource_group,
        "message": null
    })))
}

pub async fn get_resource_groups_by_subscription(
    path: web::Path<i64>,
    services: web::Data<Arc<AppServices>>,
) -> AppResult<HttpResponse> {
    let subscription_id = path.into_inner();
    
    let resource_groups = services.resource_group_use_cases.get_resource_groups_by_subscription(subscription_id).await?;
    
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "success": true,
        "data": resource_groups,
        "message": null
    })))
}
