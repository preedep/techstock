use async_trait::async_trait;
use sqlx::{PgPool, Row};
use crate::domain::{
    entities::{Resource, CreateResourceRequest, UpdateResourceRequest},
    repositories::ResourceRepository,
    errors::{DomainResult, DomainError},
    value_objects::{Pagination, PaginationParams, ResourceFilters, SortParams, SortDirection},
};

pub struct PostgresResourceRepository {
    pool: PgPool,
}

impl PostgresResourceRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl ResourceRepository for PostgresResourceRepository {
    async fn create(&self, request: CreateResourceRequest) -> DomainResult<Resource> {
        let tags_json = serde_json::to_value(&request.tags)
            .map_err(|e| DomainError::internal_error(format!("Failed to serialize tags: {}", e)))?;

        let row = sqlx::query(
            r#"
            INSERT INTO resource (
                azure_id, name, type, kind, location, subscription_id, resource_group_id,
                tags_json, extended_location, vendor, environment, provisioner
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING id, azure_id, name, type, kind, location, subscription_id, resource_group_id,
                      tags_json, extended_location, vendor, environment, provisioner, created_at, updated_at
            "#
        )
        .bind(&request.azure_id)
        .bind(&request.name)
        .bind(&request.resource_type)
        .bind(&request.kind)
        .bind(&request.location)
        .bind(request.subscription_id)
        .bind(request.resource_group_id)
        .bind(&tags_json)
        .bind(&request.extended_location)
        .bind(&request.vendor)
        .bind(&request.environment)
        .bind(&request.provisioner)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::database_error(format!("Failed to create resource: {}", e)))?;

        Ok(Resource {
            id: row.get("id"),
            azure_id: row.get("azure_id"),
            name: row.get("name"),
            resource_type: row.get("type"),
            kind: row.get("kind"),
            location: row.get("location"),
            subscription_id: row.get("subscription_id"),
            resource_group_id: row.get("resource_group_id"),
            tags_json: row.get("tags_json"),
            extended_location: row.get("extended_location"),
            vendor: row.get("vendor"),
            environment: row.get("environment"),
            provisioner: row.get("provisioner"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
    }

    async fn find_by_id(&self, id: i64) -> DomainResult<Option<Resource>> {
        let result = sqlx::query(
            r#"
            SELECT id, azure_id, name, type, kind, location, subscription_id, resource_group_id,
                   tags_json, extended_location, vendor, environment, provisioner, created_at, updated_at
            FROM resource WHERE id = $1
            "#
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::database_error(format!("Failed to find resource: {}", e)))?;

        Ok(result.map(|row| Resource {
            id: row.get("id"),
            azure_id: row.get("azure_id"),
            name: row.get("name"),
            resource_type: row.get("type"),
            kind: row.get("kind"),
            location: row.get("location"),
            subscription_id: row.get("subscription_id"),
            resource_group_id: row.get("resource_group_id"),
            tags_json: row.get("tags_json"),
            extended_location: row.get("extended_location"),
            vendor: row.get("vendor"),
            environment: row.get("environment"),
            provisioner: row.get("provisioner"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        }))
    }

    async fn find_all(
        &self,
        pagination: PaginationParams,
        filters: ResourceFilters,
        sort: SortParams,
    ) -> DomainResult<(Vec<Resource>, Pagination)> {
        let page = pagination.page();
        let size = pagination.size();
        let offset = ((page - 1) * size) as i64;

        // Build WHERE clause
        let mut where_conditions = Vec::new();
        let mut bind_values: Vec<Box<dyn sqlx::Encode<'_, sqlx::Postgres> + Send + Sync>> = Vec::new();
        let mut param_count = 0;

        if let Some(resource_type) = &filters.resource_type {
            param_count += 1;
            where_conditions.push(format!("type = ${}", param_count));
            bind_values.push(Box::new(resource_type.clone()));
        }

        if let Some(location) = &filters.location {
            param_count += 1;
            where_conditions.push(format!("location = ${}", param_count));
            bind_values.push(Box::new(location.clone()));
        }

        // Build ORDER BY clause
        let sort_field = sort.field.as_deref().unwrap_or("created_at");
        let sort_direction = match sort.direction.unwrap_or_default() {
            SortDirection::Ascending => "ASC",
            SortDirection::Descending => "DESC",
        };

        let where_clause = if where_conditions.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", where_conditions.join(" AND "))
        };

        // Get total count
        let count_query = format!("SELECT COUNT(*) as count FROM resource {}", where_clause);
        let total_row = sqlx::query(&count_query)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| DomainError::database_error(format!("Failed to count resources: {}", e)))?;
        let total: i64 = total_row.get("count");

        // Get paginated results
        let query = format!(
            r#"
            SELECT id, azure_id, name, type, kind, location, subscription_id, resource_group_id,
                   tags_json, extended_location, vendor, environment, provisioner, created_at, updated_at
            FROM resource {}
            ORDER BY {} {}
            LIMIT {} OFFSET {}
            "#,
            where_clause, sort_field, sort_direction, size, offset
        );

        let rows = sqlx::query(&query)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| DomainError::database_error(format!("Failed to fetch resources: {}", e)))?;

        let resources: Vec<Resource> = rows.into_iter().map(|row| Resource {
            id: row.get("id"),
            azure_id: row.get("azure_id"),
            name: row.get("name"),
            resource_type: row.get("type"),
            kind: row.get("kind"),
            location: row.get("location"),
            subscription_id: row.get("subscription_id"),
            resource_group_id: row.get("resource_group_id"),
            tags_json: row.get("tags_json"),
            extended_location: row.get("extended_location"),
            vendor: row.get("vendor"),
            environment: row.get("environment"),
            provisioner: row.get("provisioner"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        }).collect();

        let pagination = Pagination::new(page, size, total as u64);
        Ok((resources, pagination))
    }

    async fn update(&self, id: i64, request: UpdateResourceRequest) -> DomainResult<Resource> {
        // This is a simplified update - in production you'd build dynamic SQL
        let tags_json = if let Some(tags) = request.tags {
            Some(serde_json::to_value(&tags)
                .map_err(|e| DomainError::internal_error(format!("Failed to serialize tags: {}", e)))?)
        } else {
            None
        };

        let row = sqlx::query(
            r#"
            UPDATE resource SET
                name = COALESCE($2, name),
                type = COALESCE($3, type),
                location = COALESCE($4, location),
                tags_json = COALESCE($5, tags_json),
                vendor = COALESCE($6, vendor),
                environment = COALESCE($7, environment),
                updated_at = NOW()
            WHERE id = $1
            RETURNING id, azure_id, name, type, kind, location, subscription_id, resource_group_id,
                      tags_json, extended_location, vendor, environment, provisioner, created_at, updated_at
            "#
        )
        .bind(id)
        .bind(&request.name)
        .bind(&request.resource_type)
        .bind(&request.location)
        .bind(&tags_json)
        .bind(&request.vendor)
        .bind(&request.environment)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::database_error(format!("Failed to update resource: {}", e)))?;

        Ok(Resource {
            id: row.get("id"),
            azure_id: row.get("azure_id"),
            name: row.get("name"),
            resource_type: row.get("type"),
            kind: row.get("kind"),
            location: row.get("location"),
            subscription_id: row.get("subscription_id"),
            resource_group_id: row.get("resource_group_id"),
            tags_json: row.get("tags_json"),
            extended_location: row.get("extended_location"),
            vendor: row.get("vendor"),
            environment: row.get("environment"),
            provisioner: row.get("provisioner"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
    }

    async fn delete(&self, id: i64) -> DomainResult<()> {
        sqlx::query("DELETE FROM resource WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| DomainError::database_error(format!("Failed to delete resource: {}", e)))?;
        Ok(())
    }

    async fn find_by_subscription_id(&self, subscription_id: i64) -> DomainResult<Vec<Resource>> {
        let rows = sqlx::query(
            r#"
            SELECT r.id, r.azure_id, r.name, r.type, r.kind, r.location, r.subscription_id, r.resource_group_id,
                   r.tags_json, r.extended_location, r.vendor, r.environment, r.provisioner, r.created_at, r.updated_at
            FROM resource r WHERE r.subscription_id = $1
            "#
        )
        .bind(subscription_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::database_error(format!("Failed to find resources: {}", e)))?;

        Ok(rows.into_iter().map(|row| Resource {
            id: row.get("id"),
            azure_id: row.get("azure_id"),
            name: row.get("name"),
            resource_type: row.get("type"),
            kind: row.get("kind"),
            location: row.get("location"),
            subscription_id: row.get("subscription_id"),
            resource_group_id: row.get("resource_group_id"),
            tags_json: row.get("tags_json"),
            extended_location: row.get("extended_location"),
            vendor: row.get("vendor"),
            environment: row.get("environment"),
            provisioner: row.get("provisioner"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        }).collect())
    }

    async fn find_by_resource_group_id(&self, resource_group_id: i64) -> DomainResult<Vec<Resource>> {
        let rows = sqlx::query(
            r#"
            SELECT id, azure_id, name, type, kind, location, subscription_id, resource_group_id,
                   tags_json, extended_location, vendor, environment, provisioner, created_at, updated_at
            FROM resource WHERE resource_group_id = $1
            "#
        )
        .bind(resource_group_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::database_error(format!("Failed to find resources: {}", e)))?;

        Ok(rows.into_iter().map(|row| Resource {
            id: row.get("id"),
            azure_id: row.get("azure_id"),
            name: row.get("name"),
            resource_type: row.get("type"),
            kind: row.get("kind"),
            location: row.get("location"),
            subscription_id: row.get("subscription_id"),
            resource_group_id: row.get("resource_group_id"),
            tags_json: row.get("tags_json"),
            extended_location: row.get("extended_location"),
            vendor: row.get("vendor"),
            environment: row.get("environment"),
            provisioner: row.get("provisioner"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        }).collect())
    }

    async fn find_by_application_id(&self, application_id: i64) -> DomainResult<Vec<Resource>> {
        let rows = sqlx::query(
            r#"
            SELECT r.id, r.azure_id, r.name, r.type, r.kind, r.location, r.subscription_id, r.resource_group_id,
                   r.tags_json, r.extended_location, r.vendor, r.environment, r.provisioner, r.created_at, r.updated_at
            FROM resource r
            JOIN resource_application_map ram ON r.id = ram.resource_id
            WHERE ram.application_id = $1
            "#
        )
        .bind(application_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::database_error(format!("Failed to find resources: {}", e)))?;

        Ok(rows.into_iter().map(|row| Resource {
            id: row.get("id"),
            azure_id: row.get("azure_id"),
            name: row.get("name"),
            resource_type: row.get("type"),
            kind: row.get("kind"),
            location: row.get("location"),
            subscription_id: row.get("subscription_id"),
            resource_group_id: row.get("resource_group_id"),
            tags_json: row.get("tags_json"),
            extended_location: row.get("extended_location"),
            vendor: row.get("vendor"),
            environment: row.get("environment"),
            provisioner: row.get("provisioner"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        }).collect())
    }

    async fn count_by_type(&self) -> DomainResult<Vec<(String, i64)>> {
        let rows = sqlx::query("SELECT type, COUNT(*) as count FROM resource GROUP BY type ORDER BY count DESC")
            .fetch_all(&self.pool)
            .await
            .map_err(|e| DomainError::database_error(format!("Failed to count by type: {}", e)))?;

        Ok(rows.into_iter().map(|row| (row.get("type"), row.get("count"))).collect())
    }

    async fn count_by_location(&self) -> DomainResult<Vec<(String, i64)>> {
        let rows = sqlx::query("SELECT location, COUNT(*) as count FROM resource GROUP BY location ORDER BY count DESC")
            .fetch_all(&self.pool)
            .await
            .map_err(|e| DomainError::database_error(format!("Failed to count by location: {}", e)))?;

        Ok(rows.into_iter().map(|row| (row.get("location"), row.get("count"))).collect())
    }

    async fn count_by_environment(&self) -> DomainResult<Vec<(String, i64)>> {
        let rows = sqlx::query("SELECT COALESCE(environment, 'Unknown') as env, COUNT(*) as count FROM resource GROUP BY environment ORDER BY count DESC")
            .fetch_all(&self.pool)
            .await
            .map_err(|e| DomainError::database_error(format!("Failed to count by environment: {}", e)))?;

        Ok(rows.into_iter().map(|row| (row.get("env"), row.get("count"))).collect())
    }
}
