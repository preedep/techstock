use std::sync::Arc;
use crate::domain::{
    entities::{ResourceGroup, CreateResourceGroupRequest, UpdateResourceGroupRequest},
    repositories::{ResourceGroupRepository, SubscriptionRepository},
    errors::{DomainResult, DomainError},
    value_objects::{Pagination, PaginationParams},
};

pub struct ResourceGroupUseCases {
    repository: Arc<dyn ResourceGroupRepository>,
    subscription_repository: Arc<dyn SubscriptionRepository>,
}

impl ResourceGroupUseCases {
    pub fn new(
        repository: Arc<dyn ResourceGroupRepository>,
        subscription_repository: Arc<dyn SubscriptionRepository>,
    ) -> Self {
        Self { 
            repository,
            subscription_repository,
        }
    }

    pub async fn create_resource_group(&self, request: CreateResourceGroupRequest) -> DomainResult<ResourceGroup> {
        // Business validation
        if request.name.trim().is_empty() {
            return Err(DomainError::invalid_input("Resource group name cannot be empty"));
        }

        // Check if subscription exists
        if self.subscription_repository.find_by_id(request.subscription_id).await?.is_none() {
            return Err(DomainError::not_found("Subscription", request.subscription_id));
        }

        // Check if resource group with same name already exists in the subscription
        if let Some(_) = self.repository.find_by_name_and_subscription(&request.name, request.subscription_id).await? {
            return Err(DomainError::already_exists(
                "ResourceGroup", 
                "name in subscription", 
                format!("{} in subscription {}", request.name, request.subscription_id)
            ));
        }

        self.repository.create(request).await
    }

    pub async fn get_resource_group_by_id(&self, id: i64) -> DomainResult<ResourceGroup> {
        match self.repository.find_by_id(id).await? {
            Some(resource_group) => Ok(resource_group),
            None => Err(DomainError::not_found("ResourceGroup", id)),
        }
    }

    pub async fn list_resource_groups(&self, pagination: PaginationParams) -> DomainResult<(Vec<ResourceGroup>, Pagination)> {
        self.repository.find_all(pagination).await
    }

    pub async fn list_all(&self) -> DomainResult<Vec<ResourceGroup>> {
        // Get all resource groups without pagination
        let pagination = PaginationParams {
            page: Some(1),
            size: Some(10000), // Large number to get all
        };
        let (resource_groups, _) = self.repository.find_all(pagination).await?;
        Ok(resource_groups)
    }

    pub async fn update_resource_group(&self, id: i64, request: UpdateResourceGroupRequest) -> DomainResult<ResourceGroup> {
        // Check if resource group exists
        let existing = match self.repository.find_by_id(id).await? {
            Some(rg) => rg,
            None => return Err(DomainError::not_found("ResourceGroup", id)),
        };

        // Business validation
        if let Some(ref name) = request.name {
            if name.trim().is_empty() {
                return Err(DomainError::invalid_input("Resource group name cannot be empty"));
            }
        }

        // Check subscription exists if being updated
        let subscription_id = request.subscription_id.unwrap_or(existing.subscription_id);
        if self.subscription_repository.find_by_id(subscription_id).await?.is_none() {
            return Err(DomainError::not_found("Subscription", subscription_id));
        }

        // Check for name conflicts
        if let Some(ref name) = request.name {
            if let Some(conflicting) = self.repository.find_by_name_and_subscription(name, subscription_id).await? {
                if conflicting.id != id {
                    return Err(DomainError::already_exists(
                        "ResourceGroup", 
                        "name in subscription", 
                        format!("{} in subscription {}", name, subscription_id)
                    ));
                }
            }
        }

        self.repository.update(id, request).await
    }

    pub async fn delete_resource_group(&self, id: i64) -> DomainResult<()> {
        // Check if resource group exists
        if self.repository.find_by_id(id).await?.is_none() {
            return Err(DomainError::not_found("ResourceGroup", id));
        }

        self.repository.delete(id).await
    }

    pub async fn get_resource_groups_by_subscription(&self, subscription_id: i64) -> DomainResult<Vec<ResourceGroup>> {
        // Check if subscription exists
        if self.subscription_repository.find_by_id(subscription_id).await?.is_none() {
            return Err(DomainError::not_found("Subscription", subscription_id));
        }

        self.repository.find_by_subscription_id(subscription_id).await
    }
}
