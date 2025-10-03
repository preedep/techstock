use async_trait::async_trait;
use crate::domain::{
    entities::{Subscription, CreateSubscriptionRequest, UpdateSubscriptionRequest},
    errors::DomainResult,
    value_objects::{Pagination, PaginationParams},
};

#[async_trait]
pub trait SubscriptionRepository: Send + Sync {
    async fn create(&self, request: CreateSubscriptionRequest) -> DomainResult<Subscription>;
    async fn find_by_id(&self, id: i64) -> DomainResult<Option<Subscription>>;
    async fn find_all(&self, pagination: PaginationParams) -> DomainResult<(Vec<Subscription>, Pagination)>;
    async fn update(&self, id: i64, request: UpdateSubscriptionRequest) -> DomainResult<Subscription>;
    async fn delete(&self, id: i64) -> DomainResult<()>;
    async fn find_by_name(&self, name: &str) -> DomainResult<Option<Subscription>>;
}
