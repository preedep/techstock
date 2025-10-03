use std::sync::Arc;
use crate::domain::{
    entities::{Resource, CreateResourceRequest, UpdateResourceRequest},
    repositories::ResourceRepository,
    errors::{DomainResult, DomainError},
    value_objects::{Pagination, PaginationParams, ResourceFilters, SortParams},
};

pub struct ResourceUseCases {
    repository: Arc<dyn ResourceRepository>,
}

impl ResourceUseCases {
    pub fn new(repository: Arc<dyn ResourceRepository>) -> Self {
        Self { repository }
    }

    pub async fn create_resource(&self, request: CreateResourceRequest) -> DomainResult<Resource> {
        // Business validation
        if request.name.trim().is_empty() {
            return Err(DomainError::invalid_input("Resource name cannot be empty"));
        }

        if request.resource_type.trim().is_empty() {
            return Err(DomainError::invalid_input("Resource type cannot be empty"));
        }

        if request.location.trim().is_empty() {
            return Err(DomainError::invalid_input("Location cannot be empty"));
        }

        self.repository.create(request).await
    }

    pub async fn get_resource_by_id(&self, id: i64) -> DomainResult<Resource> {
        match self.repository.find_by_id(id).await? {
            Some(resource) => Ok(resource),
            None => Err(DomainError::not_found("Resource", id)),
        }
    }

    pub async fn list_resources(
        &self,
        pagination: PaginationParams,
        filters: ResourceFilters,
        sort: SortParams,
    ) -> DomainResult<(Vec<Resource>, Pagination)> {
        self.repository.find_all(pagination, filters, sort).await
    }

    pub async fn update_resource(&self, id: i64, request: UpdateResourceRequest) -> DomainResult<Resource> {
        // Check if resource exists
        if self.repository.find_by_id(id).await?.is_none() {
            return Err(DomainError::not_found("Resource", id));
        }

        // Business validation
        if let Some(ref name) = request.name {
            if name.trim().is_empty() {
                return Err(DomainError::invalid_input("Resource name cannot be empty"));
            }
        }

        if let Some(ref resource_type) = request.resource_type {
            if resource_type.trim().is_empty() {
                return Err(DomainError::invalid_input("Resource type cannot be empty"));
            }
        }

        if let Some(ref location) = request.location {
            if location.trim().is_empty() {
                return Err(DomainError::invalid_input("Location cannot be empty"));
            }
        }

        self.repository.update(id, request).await
    }

    pub async fn delete_resource(&self, id: i64) -> DomainResult<()> {
        // Check if resource exists
        if self.repository.find_by_id(id).await?.is_none() {
            return Err(DomainError::not_found("Resource", id));
        }

        self.repository.delete(id).await
    }

    pub async fn get_resources_by_subscription(&self, subscription_id: i64) -> DomainResult<Vec<Resource>> {
        self.repository.find_by_subscription_id(subscription_id).await
    }

    pub async fn get_resources_by_resource_group(&self, resource_group_id: i64) -> DomainResult<Vec<Resource>> {
        self.repository.find_by_resource_group_id(resource_group_id).await
    }

    pub async fn get_resources_by_application(&self, application_id: i64) -> DomainResult<Vec<Resource>> {
        self.repository.find_by_application_id(application_id).await
    }

    pub async fn get_resource_statistics(&self) -> DomainResult<ResourceStatistics> {
        let type_counts = self.repository.count_by_type().await?;
        let location_counts = self.repository.count_by_location().await?;
        let environment_counts = self.repository.count_by_environment().await?;

        Ok(ResourceStatistics {
            by_type: type_counts,
            by_location: location_counts,
            by_environment: environment_counts,
        })
    }

    pub async fn list_all_resources(&self) -> DomainResult<Vec<Resource>> {
        // Get all resources without pagination for tags analysis
        let pagination = PaginationParams {
            page: Some(1),
            size: Some(10000), // Large number to get all
        };
        let filters = ResourceFilters {
            resource_type: None,
            location: None,
            environment: None,
            vendor: None,
            subscription_id: None,
            resource_group_id: None,
            search: None,
            tags: None,
        };
        let sort = SortParams {
            field: None,
            direction: None,
        };
        
        let (resources, _) = self.repository.find_all(pagination, filters, sort).await?;
        Ok(resources)
    }
}

#[derive(Debug, serde::Serialize)]
pub struct ResourceStatistics {
    pub by_type: Vec<(String, i64)>,
    pub by_location: Vec<(String, i64)>,
    pub by_environment: Vec<(String, i64)>,
}
