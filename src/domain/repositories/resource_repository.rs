use async_trait::async_trait;
use crate::domain::{
    entities::{Resource, CreateResourceRequest, UpdateResourceRequest},
    errors::DomainResult,
    value_objects::{Pagination, PaginationParams, ResourceFilters, SortParams},
};

#[async_trait]
pub trait ResourceRepository: Send + Sync {
    async fn create(&self, request: CreateResourceRequest) -> DomainResult<Resource>;
    async fn find_by_id(&self, id: i64) -> DomainResult<Option<Resource>>;
    async fn find_all(
        &self,
        pagination: PaginationParams,
        filters: ResourceFilters,
        sort: SortParams,
    ) -> DomainResult<(Vec<Resource>, Pagination)>;
    async fn update(&self, id: i64, request: UpdateResourceRequest) -> DomainResult<Resource>;
    async fn delete(&self, id: i64) -> DomainResult<()>;
    async fn find_by_subscription_id(&self, subscription_id: i64) -> DomainResult<Vec<Resource>>;
    async fn find_by_resource_group_id(&self, resource_group_id: i64) -> DomainResult<Vec<Resource>>;
    async fn find_by_application_id(&self, application_id: i64) -> DomainResult<Vec<Resource>>;
    async fn count_by_type(&self) -> DomainResult<Vec<(String, i64)>>;
    async fn count_by_location(&self) -> DomainResult<Vec<(String, i64)>>;
    async fn count_by_environment(&self) -> DomainResult<Vec<(String, i64)>>;
    async fn get_distinct_resource_types(&self) -> DomainResult<Vec<String>>;
    
    // Filtered count methods for dashboard
    async fn count_by_type_filtered(&self, subscription_id: Option<i64>, resource_group_id: Option<i64>, location: Option<&str>, environment: Option<&str>) -> DomainResult<Vec<(String, i64)>>;
    async fn count_by_location_filtered(&self, subscription_id: Option<i64>, resource_group_id: Option<i64>, environment: Option<&str>) -> DomainResult<Vec<(String, i64)>>;
    async fn count_by_environment_filtered(&self, subscription_id: Option<i64>, resource_group_id: Option<i64>, location: Option<&str>) -> DomainResult<Vec<(String, i64)>>;
}
