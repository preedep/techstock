use async_trait::async_trait;
use crate::domain::{
    entities::{ResourceGroup, CreateResourceGroupRequest, UpdateResourceGroupRequest},
    errors::DomainResult,
    value_objects::{Pagination, PaginationParams},
};

#[async_trait]
pub trait ResourceGroupRepository: Send + Sync {
    async fn create(&self, request: CreateResourceGroupRequest) -> DomainResult<ResourceGroup>;
    async fn find_by_id(&self, id: i64) -> DomainResult<Option<ResourceGroup>>;
    async fn find_all(&self, pagination: PaginationParams) -> DomainResult<(Vec<ResourceGroup>, Pagination)>;
    async fn update(&self, id: i64, request: UpdateResourceGroupRequest) -> DomainResult<ResourceGroup>;
    async fn delete(&self, id: i64) -> DomainResult<()>;
    async fn find_by_subscription_id(&self, subscription_id: i64) -> DomainResult<Vec<ResourceGroup>>;
    async fn find_by_name_and_subscription(&self, name: &str, subscription_id: i64) -> DomainResult<Option<ResourceGroup>>;
}
