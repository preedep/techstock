use async_trait::async_trait;
use crate::domain::{
    entities::{Application, CreateApplicationRequest, UpdateApplicationRequest},
    errors::DomainResult,
    value_objects::{Pagination, PaginationParams},
};

#[async_trait]
pub trait ApplicationRepository: Send + Sync {
    async fn create(&self, request: CreateApplicationRequest) -> DomainResult<Application>;
    async fn find_by_id(&self, id: i64) -> DomainResult<Option<Application>>;
    async fn find_all(&self, pagination: PaginationParams) -> DomainResult<(Vec<Application>, Pagination)>;
    async fn update(&self, id: i64, request: UpdateApplicationRequest) -> DomainResult<Application>;
    async fn delete(&self, id: i64) -> DomainResult<()>;
    async fn find_by_code(&self, code: &str) -> DomainResult<Option<Application>>;
    async fn find_by_owner_email(&self, owner_email: &str) -> DomainResult<Vec<Application>>;
}
