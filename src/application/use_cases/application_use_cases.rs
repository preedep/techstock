use std::sync::Arc;
use crate::domain::{
    entities::{Application, CreateApplicationRequest, UpdateApplicationRequest},
    repositories::ApplicationRepository,
    errors::{DomainResult, DomainError},
    value_objects::{Pagination, PaginationParams},
};

pub struct ApplicationUseCases {
    repository: Arc<dyn ApplicationRepository>,
}

impl ApplicationUseCases {
    pub fn new(repository: Arc<dyn ApplicationRepository>) -> Self {
        Self { repository }
    }

    pub async fn create_application(&self, request: CreateApplicationRequest) -> DomainResult<Application> {
        // Business validation
        if let Some(ref code) = request.code {
            if code.trim().is_empty() {
                return Err(DomainError::invalid_input("Application code cannot be empty"));
            }

            // Check if application with same code already exists
            if let Some(_) = self.repository.find_by_code(code).await? {
                return Err(DomainError::already_exists("Application", "code", code));
            }
        }

        if let Some(ref owner_email) = request.owner_email {
            if !owner_email.contains('@') {
                return Err(DomainError::invalid_input("Invalid email format"));
            }
        }

        self.repository.create(request).await
    }

    pub async fn get_application_by_id(&self, id: i64) -> DomainResult<Application> {
        match self.repository.find_by_id(id).await? {
            Some(application) => Ok(application),
            None => Err(DomainError::not_found("Application", id)),
        }
    }

    pub async fn list_applications(&self, pagination: PaginationParams) -> DomainResult<(Vec<Application>, Pagination)> {
        self.repository.find_all(pagination).await
    }

    pub async fn update_application(&self, id: i64, request: UpdateApplicationRequest) -> DomainResult<Application> {
        // Check if application exists
        if self.repository.find_by_id(id).await?.is_none() {
            return Err(DomainError::not_found("Application", id));
        }

        // Business validation
        if let Some(ref code) = request.code {
            if code.trim().is_empty() {
                return Err(DomainError::invalid_input("Application code cannot be empty"));
            }

            // Check if another application with same code exists
            if let Some(existing) = self.repository.find_by_code(code).await? {
                if existing.id != id {
                    return Err(DomainError::already_exists("Application", "code", code));
                }
            }
        }

        if let Some(ref owner_email) = request.owner_email {
            if !owner_email.contains('@') {
                return Err(DomainError::invalid_input("Invalid email format"));
            }
        }

        self.repository.update(id, request).await
    }

    pub async fn delete_application(&self, id: i64) -> DomainResult<()> {
        // Check if application exists
        if self.repository.find_by_id(id).await?.is_none() {
            return Err(DomainError::not_found("Application", id));
        }

        self.repository.delete(id).await
    }

    pub async fn get_application_by_code(&self, code: &str) -> DomainResult<Option<Application>> {
        self.repository.find_by_code(code).await
    }

    pub async fn get_applications_by_owner(&self, owner_email: &str) -> DomainResult<Vec<Application>> {
        self.repository.find_by_owner_email(owner_email).await
    }
}
