use sqlx::{PgPool, Row};
use std::env;
use crate::domain::errors::{DomainResult, DomainError};

pub struct Database {
    pub pool: PgPool,
}

impl Database {
    pub async fn new() -> DomainResult<Self> {
        let database_url = env::var("DATABASE_URL")
            .map_err(|_| DomainError::internal_error("DATABASE_URL environment variable not set"))?;

        let pool = PgPool::connect(&database_url)
            .await
            .map_err(|e| DomainError::database_error(format!("Failed to connect to database: {}", e)))?;

        Ok(Self { pool })
    }

    pub async fn health_check(&self) -> DomainResult<()> {
        sqlx::query("SELECT 1")
            .fetch_one(&self.pool)
            .await
            .map_err(|e| DomainError::database_error(format!("Health check failed: {}", e)))?;
        
        Ok(())
    }

    pub async fn get_total_count(&self, table: &str) -> DomainResult<i64> {
        let query = format!("SELECT COUNT(*) as count FROM {}", table);
        let row = sqlx::query(&query)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| DomainError::database_error(format!("Failed to count records: {}", e)))?;
        
        Ok(row.get("count"))
    }
}
