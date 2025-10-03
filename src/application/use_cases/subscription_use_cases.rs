use std::sync::Arc;
use crate::domain::{
    entities::{Subscription, CreateSubscriptionRequest, UpdateSubscriptionRequest},
    repositories::SubscriptionRepository,
    errors::{DomainResult, DomainError},
    value_objects::{Pagination, PaginationParams},
};

pub struct SubscriptionUseCases {
    repository: Arc<dyn SubscriptionRepository>,
}

impl SubscriptionUseCases {
    pub fn new(repository: Arc<dyn SubscriptionRepository>) -> Self {
        Self { repository }
    }

    pub async fn create_subscription(&self, request: CreateSubscriptionRequest) -> DomainResult<Subscription> {
        // Business validation
        if request.name.trim().is_empty() {
            return Err(DomainError::invalid_input("Subscription name cannot be empty"));
        }

        // Check if subscription with same name already exists
        if let Some(_) = self.repository.find_by_name(&request.name).await? {
            return Err(DomainError::already_exists("Subscription", "name", &request.name));
        }

        self.repository.create(request).await
    }

    pub async fn get_subscription_by_id(&self, id: i64) -> DomainResult<Subscription> {
        match self.repository.find_by_id(id).await? {
            Some(subscription) => Ok(subscription),
            None => Err(DomainError::not_found("Subscription", id)),
        }
    }

    pub async fn list_subscriptions(&self, pagination: PaginationParams) -> DomainResult<(Vec<Subscription>, Pagination)> {
        self.repository.find_all(pagination).await
    }

    pub async fn update_subscription(&self, id: i64, request: UpdateSubscriptionRequest) -> DomainResult<Subscription> {
        // Check if subscription exists
        if self.repository.find_by_id(id).await?.is_none() {
            return Err(DomainError::not_found("Subscription", id));
        }

        // Business validation
        if let Some(ref name) = request.name {
            if name.trim().is_empty() {
                return Err(DomainError::invalid_input("Subscription name cannot be empty"));
            }

            // Check if another subscription with same name exists
            if let Some(existing) = self.repository.find_by_name(name).await? {
                if existing.id != id {
                    return Err(DomainError::already_exists("Subscription", "name", name));
                }
            }
        }

        self.repository.update(id, request).await
    }

    pub async fn delete_subscription(&self, id: i64) -> DomainResult<()> {
        // Check if subscription exists
        if self.repository.find_by_id(id).await?.is_none() {
            return Err(DomainError::not_found("Subscription", id));
        }

        self.repository.delete(id).await
    }

    pub async fn get_subscription_by_name(&self, name: &str) -> DomainResult<Option<Subscription>> {
        self.repository.find_by_name(name).await
    }
}
