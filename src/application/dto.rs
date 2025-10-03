use serde::{Deserialize, Serialize};
use validator::Validate;
use std::collections::HashMap;

// Resource DTOs
#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct CreateResourceDto {
    #[validate(length(min = 1, message = "Name is required"))]
    pub name: String,
    
    #[validate(length(min = 1, message = "Resource type is required"))]
    pub resource_type: String,
    
    pub kind: Option<String>,
    
    #[validate(length(min = 1, message = "Location is required"))]
    pub location: String,
    
    pub subscription_id: i64,
    pub resource_group_id: i64,
    pub tags: Option<HashMap<String, String>>,
    pub extended_location: Option<String>,
    pub vendor: Option<String>,
    pub environment: Option<String>,
    pub provisioner: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct UpdateResourceDto {
    #[validate(length(min = 1, message = "Name cannot be empty"))]
    pub name: Option<String>,
    
    #[validate(length(min = 1, message = "Resource type cannot be empty"))]
    pub resource_type: Option<String>,
    
    pub kind: Option<String>,
    
    #[validate(length(min = 1, message = "Location cannot be empty"))]
    pub location: Option<String>,
    
    pub subscription_id: Option<i64>,
    pub resource_group_id: Option<i64>,
    pub tags: Option<HashMap<String, String>>,
    pub extended_location: Option<String>,
    pub vendor: Option<String>,
    pub environment: Option<String>,
    pub provisioner: Option<String>,
}

// Subscription DTOs
#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct CreateSubscriptionDto {
    #[validate(length(min = 1, message = "Name is required"))]
    pub name: String,
    pub tenant_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct UpdateSubscriptionDto {
    #[validate(length(min = 1, message = "Name cannot be empty"))]
    pub name: Option<String>,
    pub tenant_id: Option<String>,
}

// Resource Group DTOs
#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct CreateResourceGroupDto {
    #[validate(length(min = 1, message = "Name is required"))]
    pub name: String,
    pub subscription_id: i64,
}

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct UpdateResourceGroupDto {
    #[validate(length(min = 1, message = "Name cannot be empty"))]
    pub name: Option<String>,
    pub subscription_id: Option<i64>,
}

// Application DTOs
#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct CreateApplicationDto {
    #[validate(length(min = 1, message = "Code cannot be empty"))]
    pub code: Option<String>,
    pub name: Option<String>,
    pub owner_team: Option<String>,
    
    #[validate(email(message = "Invalid email format"))]
    pub owner_email: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Validate)]
pub struct UpdateApplicationDto {
    #[validate(length(min = 1, message = "Code cannot be empty"))]
    pub code: Option<String>,
    pub name: Option<String>,
    pub owner_team: Option<String>,
    
    #[validate(email(message = "Invalid email format"))]
    pub owner_email: Option<String>,
}

// Query DTOs
#[derive(Debug, Serialize, Deserialize)]
pub struct ResourceQueryDto {
    pub page: Option<u32>,
    pub size: Option<u32>,
    pub resource_type: Option<String>,
    pub location: Option<String>,
    pub environment: Option<String>,
    pub vendor: Option<String>,
    pub subscription_id: Option<i64>,
    pub resource_group_id: Option<i64>,
    pub search: Option<String>,
    pub tags: Option<String>,
    pub sort_field: Option<String>,
    pub sort_direction: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PaginationQueryDto {
    pub page: Option<u32>,
    pub size: Option<u32>,
}
