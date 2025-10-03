use async_trait::async_trait;
use sqlx::{PgPool, Row};
use crate::domain::{
    entities::{Subscription, CreateSubscriptionRequest, UpdateSubscriptionRequest},
    repositories::SubscriptionRepository,
    errors::{DomainResult, DomainError},
    value_objects::{Pagination, PaginationParams},
};

pub struct PostgresSubscriptionRepository {
    pool: PgPool,
}

impl PostgresSubscriptionRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl SubscriptionRepository for PostgresSubscriptionRepository {
    async fn create(&self, request: CreateSubscriptionRequest) -> DomainResult<Subscription> {
        let row = sqlx::query(
            "INSERT INTO subscription (name, tenant_id) VALUES ($1, $2) RETURNING id, name, tenant_id"
        )
        .bind(&request.name)
        .bind(&request.tenant_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::database_error(format!("Failed to create subscription: {}", e)))?;

        Ok(Subscription {
            id: row.get("id"),
            name: row.get("name"),
            tenant_id: row.get("tenant_id"),
        })
    }

    async fn find_by_id(&self, id: i64) -> DomainResult<Option<Subscription>> {
        let result = sqlx::query("SELECT id, name, tenant_id FROM subscription WHERE id = $1")
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| DomainError::database_error(format!("Failed to find subscription: {}", e)))?;

        Ok(result.map(|row| Subscription {
            id: row.get("id"),
            name: row.get("name"),
            tenant_id: row.get("tenant_id"),
        }))
    }

    async fn find_all(&self, pagination: PaginationParams) -> DomainResult<(Vec<Subscription>, Pagination)> {
        let page = pagination.page();
        let size = pagination.size();
        let offset = ((page - 1) * size) as i64;

        // Get total count
        let total_row = sqlx::query("SELECT COUNT(*) as count FROM subscription")
            .fetch_one(&self.pool)
            .await
            .map_err(|e| DomainError::database_error(format!("Failed to count subscriptions: {}", e)))?;
        let total: i64 = total_row.get("count");

        // Get paginated results
        let rows = sqlx::query(
            "SELECT id, name, tenant_id FROM subscription ORDER BY name LIMIT $1 OFFSET $2"
        )
        .bind(size as i64)
        .bind(offset)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::database_error(format!("Failed to fetch subscriptions: {}", e)))?;

        let subscriptions: Vec<Subscription> = rows.into_iter().map(|row| Subscription {
            id: row.get("id"),
            name: row.get("name"),
            tenant_id: row.get("tenant_id"),
        }).collect();

        let pagination = Pagination::new(page, size, total as u64);
        Ok((subscriptions, pagination))
    }

    async fn update(&self, id: i64, request: UpdateSubscriptionRequest) -> DomainResult<Subscription> {
        let row = sqlx::query(
            r#"
            UPDATE subscription SET
                name = COALESCE($2, name),
                tenant_id = COALESCE($3, tenant_id)
            WHERE id = $1
            RETURNING id, name, tenant_id
            "#
        )
        .bind(id)
        .bind(&request.name)
        .bind(&request.tenant_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::database_error(format!("Failed to update subscription: {}", e)))?;

        Ok(Subscription {
            id: row.get("id"),
            name: row.get("name"),
            tenant_id: row.get("tenant_id"),
        })
    }

    async fn delete(&self, id: i64) -> DomainResult<()> {
        sqlx::query("DELETE FROM subscription WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| DomainError::database_error(format!("Failed to delete subscription: {}", e)))?;
        Ok(())
    }

    async fn find_by_name(&self, name: &str) -> DomainResult<Option<Subscription>> {
        let result = sqlx::query("SELECT id, name, tenant_id FROM subscription WHERE name = $1")
            .bind(name)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| DomainError::database_error(format!("Failed to find subscription by name: {}", e)))?;

        Ok(result.map(|row| Subscription {
            id: row.get("id"),
            name: row.get("name"),
            tenant_id: row.get("tenant_id"),
        }))
    }

    async fn count_all(&self) -> DomainResult<i64> {
        let row = sqlx::query("SELECT COUNT(*) as count FROM subscription")
            .fetch_one(&self.pool)
            .await
            .map_err(|e| DomainError::database_error(format!("Failed to count subscriptions: {}", e)))?;
        
        Ok(row.get("count"))
    }
}
