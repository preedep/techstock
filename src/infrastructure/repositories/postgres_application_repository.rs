use async_trait::async_trait;
use sqlx::{PgPool, Row};
use crate::domain::{
    entities::{Application, CreateApplicationRequest, UpdateApplicationRequest},
    repositories::ApplicationRepository,
    errors::{DomainResult, DomainError},
    value_objects::{Pagination, PaginationParams},
};

pub struct PostgresApplicationRepository {
    pool: PgPool,
}

impl PostgresApplicationRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl ApplicationRepository for PostgresApplicationRepository {
    async fn create(&self, request: CreateApplicationRequest) -> DomainResult<Application> {
        let row = sqlx::query(
            "INSERT INTO application (code, name, owner_team, owner_email) VALUES ($1, $2, $3, $4) RETURNING id, code, name, owner_team, owner_email"
        )
        .bind(&request.code)
        .bind(&request.name)
        .bind(&request.owner_team)
        .bind(&request.owner_email)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::database_error(format!("Failed to create application: {}", e)))?;

        Ok(Application {
            id: row.get("id"),
            code: row.get("code"),
            name: row.get("name"),
            owner_team: row.get("owner_team"),
            owner_email: row.get("owner_email"),
        })
    }

    async fn find_by_id(&self, id: i64) -> DomainResult<Option<Application>> {
        let result = sqlx::query("SELECT id, code, name, owner_team, owner_email FROM application WHERE id = $1")
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| DomainError::database_error(format!("Failed to find application: {}", e)))?;

        Ok(result.map(|row| Application {
            id: row.get("id"),
            code: row.get("code"),
            name: row.get("name"),
            owner_team: row.get("owner_team"),
            owner_email: row.get("owner_email"),
        }))
    }

    async fn find_all(&self, pagination: PaginationParams) -> DomainResult<(Vec<Application>, Pagination)> {
        let page = pagination.page();
        let size = pagination.size();
        let offset = ((page - 1) * size) as i64;

        let total_row = sqlx::query("SELECT COUNT(*) as count FROM application")
            .fetch_one(&self.pool)
            .await
            .map_err(|e| DomainError::database_error(format!("Failed to count applications: {}", e)))?;
        let total: i64 = total_row.get("count");

        let rows = sqlx::query(
            "SELECT id, code, name, owner_team, owner_email FROM application ORDER BY COALESCE(name, code) LIMIT $1 OFFSET $2"
        )
        .bind(size as i64)
        .bind(offset)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::database_error(format!("Failed to fetch applications: {}", e)))?;

        let applications: Vec<Application> = rows.into_iter().map(|row| Application {
            id: row.get("id"),
            code: row.get("code"),
            name: row.get("name"),
            owner_team: row.get("owner_team"),
            owner_email: row.get("owner_email"),
        }).collect();

        let pagination = Pagination::new(page, size, total as u64);
        Ok((applications, pagination))
    }

    async fn update(&self, id: i64, request: UpdateApplicationRequest) -> DomainResult<Application> {
        let row = sqlx::query(
            r#"
            UPDATE application SET
                code = COALESCE($2, code),
                name = COALESCE($3, name),
                owner_team = COALESCE($4, owner_team),
                owner_email = COALESCE($5, owner_email)
            WHERE id = $1
            RETURNING id, code, name, owner_team, owner_email
            "#
        )
        .bind(id)
        .bind(&request.code)
        .bind(&request.name)
        .bind(&request.owner_team)
        .bind(&request.owner_email)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::database_error(format!("Failed to update application: {}", e)))?;

        Ok(Application {
            id: row.get("id"),
            code: row.get("code"),
            name: row.get("name"),
            owner_team: row.get("owner_team"),
            owner_email: row.get("owner_email"),
        })
    }

    async fn delete(&self, id: i64) -> DomainResult<()> {
        sqlx::query("DELETE FROM application WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| DomainError::database_error(format!("Failed to delete application: {}", e)))?;
        Ok(())
    }

    async fn find_by_code(&self, code: &str) -> DomainResult<Option<Application>> {
        let result = sqlx::query("SELECT id, code, name, owner_team, owner_email FROM application WHERE code = $1")
            .bind(code)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| DomainError::database_error(format!("Failed to find application by code: {}", e)))?;

        Ok(result.map(|row| Application {
            id: row.get("id"),
            code: row.get("code"),
            name: row.get("name"),
            owner_team: row.get("owner_team"),
            owner_email: row.get("owner_email"),
        }))
    }

    async fn find_by_owner_email(&self, owner_email: &str) -> DomainResult<Vec<Application>> {
        let rows = sqlx::query(
            "SELECT id, code, name, owner_team, owner_email FROM application WHERE owner_email = $1 ORDER BY COALESCE(name, code)"
        )
        .bind(owner_email)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::database_error(format!("Failed to find applications by owner: {}", e)))?;

        Ok(rows.into_iter().map(|row| Application {
            id: row.get("id"),
            code: row.get("code"),
            name: row.get("name"),
            owner_team: row.get("owner_team"),
            owner_email: row.get("owner_email"),
        }).collect())
    }
}
