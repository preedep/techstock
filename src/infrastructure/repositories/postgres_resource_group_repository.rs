use async_trait::async_trait;
use sqlx::{PgPool, Row};
use crate::domain::{
    entities::{ResourceGroup, CreateResourceGroupRequest, UpdateResourceGroupRequest},
    repositories::ResourceGroupRepository,
    errors::{DomainResult, DomainError},
    value_objects::{Pagination, PaginationParams},
};

pub struct PostgresResourceGroupRepository {
    pool: PgPool,
}

impl PostgresResourceGroupRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl ResourceGroupRepository for PostgresResourceGroupRepository {
    async fn create(&self, request: CreateResourceGroupRequest) -> DomainResult<ResourceGroup> {
        let row = sqlx::query(
            "INSERT INTO resource_group (name, subscription_id) VALUES ($1, $2) RETURNING id, name, subscription_id"
        )
        .bind(&request.name)
        .bind(request.subscription_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::database_error(format!("Failed to create resource group: {}", e)))?;

        Ok(ResourceGroup {
            id: row.get("id"),
            name: row.get("name"),
            subscription_id: row.get("subscription_id"),
        })
    }

    async fn find_by_id(&self, id: i64) -> DomainResult<Option<ResourceGroup>> {
        let result = sqlx::query("SELECT id, name, subscription_id FROM resource_group WHERE id = $1")
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| DomainError::database_error(format!("Failed to find resource group: {}", e)))?;

        Ok(result.map(|row| ResourceGroup {
            id: row.get("id"),
            name: row.get("name"),
            subscription_id: row.get("subscription_id"),
        }))
    }

    async fn find_all(&self, pagination: PaginationParams) -> DomainResult<(Vec<ResourceGroup>, Pagination)> {
        let page = pagination.page();
        let size = pagination.size();
        let offset = ((page - 1) * size) as i64;

        let total_row = sqlx::query("SELECT COUNT(*) as count FROM resource_group")
            .fetch_one(&self.pool)
            .await
            .map_err(|e| DomainError::database_error(format!("Failed to count resource groups: {}", e)))?;
        let total: i64 = total_row.get("count");

        let rows = sqlx::query(
            "SELECT id, name, subscription_id FROM resource_group ORDER BY name LIMIT $1 OFFSET $2"
        )
        .bind(size as i64)
        .bind(offset)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::database_error(format!("Failed to fetch resource groups: {}", e)))?;

        let resource_groups: Vec<ResourceGroup> = rows.into_iter().map(|row| ResourceGroup {
            id: row.get("id"),
            name: row.get("name"),
            subscription_id: row.get("subscription_id"),
        }).collect();

        let pagination = Pagination::new(page, size, total as u64);
        Ok((resource_groups, pagination))
    }

    async fn update(&self, id: i64, request: UpdateResourceGroupRequest) -> DomainResult<ResourceGroup> {
        let row = sqlx::query(
            r#"
            UPDATE resource_group SET
                name = COALESCE($2, name),
                subscription_id = COALESCE($3, subscription_id)
            WHERE id = $1
            RETURNING id, name, subscription_id
            "#
        )
        .bind(id)
        .bind(&request.name)
        .bind(request.subscription_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::database_error(format!("Failed to update resource group: {}", e)))?;

        Ok(ResourceGroup {
            id: row.get("id"),
            name: row.get("name"),
            subscription_id: row.get("subscription_id"),
        })
    }

    async fn delete(&self, id: i64) -> DomainResult<()> {
        sqlx::query("DELETE FROM resource_group WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| DomainError::database_error(format!("Failed to delete resource group: {}", e)))?;
        Ok(())
    }

    async fn find_by_subscription_id(&self, subscription_id: i64) -> DomainResult<Vec<ResourceGroup>> {
        let rows = sqlx::query(
            "SELECT id, name, subscription_id FROM resource_group WHERE subscription_id = $1 ORDER BY name"
        )
        .bind(subscription_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::database_error(format!("Failed to find resource groups: {}", e)))?;

        Ok(rows.into_iter().map(|row| ResourceGroup {
            id: row.get("id"),
            name: row.get("name"),
            subscription_id: row.get("subscription_id"),
        }).collect())
    }

    async fn find_by_name_and_subscription(&self, name: &str, subscription_id: i64) -> DomainResult<Option<ResourceGroup>> {
        let result = sqlx::query(
            "SELECT id, name, subscription_id FROM resource_group WHERE name = $1 AND subscription_id = $2"
        )
        .bind(name)
        .bind(subscription_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::database_error(format!("Failed to find resource group: {}", e)))?;

        Ok(result.map(|row| ResourceGroup {
            id: row.get("id"),
            name: row.get("name"),
            subscription_id: row.get("subscription_id"),
        }))
    }

    async fn count_all(&self) -> DomainResult<i64> {
        let row = sqlx::query("SELECT COUNT(*) as count FROM resource_group")
            .fetch_one(&self.pool)
            .await
            .map_err(|e| DomainError::database_error(format!("Failed to count resource groups: {}", e)))?;
        
        Ok(row.get("count"))
    }
}
