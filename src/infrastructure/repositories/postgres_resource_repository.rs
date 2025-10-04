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

        // Build WHERE clause dynamically
        let mut where_conditions = Vec::new();

        if let Some(resource_type) = &filters.resource_type {
            where_conditions.push(format!("type ILIKE '%{}%'", resource_type.replace("'", "''")));
        }

        if let Some(location) = &filters.location {
            where_conditions.push(format!("location = '{}'", location.replace("'", "''")));
        }

        if let Some(environment) = &filters.environment {
            where_conditions.push(format!("environment = '{}'", environment.replace("'", "''")));
        }

        if let Some(vendor) = &filters.vendor {
            where_conditions.push(format!("vendor = '{}'", vendor.replace("'", "''")));
        }

        if let Some(subscription_id) = filters.subscription_id {
            where_conditions.push(format!("subscription_id = {}", subscription_id));
        }

        if let Some(resource_group_id) = filters.resource_group_id {
            where_conditions.push(format!("resource_group_id = {}", resource_group_id));
        }

        if let Some(search) = &filters.search {
            let escaped_search = search.replace("'", "''");
            // Search in multiple fields: name, type, azure_id, location, vendor, environment
            where_conditions.push(format!(
                "(name ILIKE '%{}%' OR type ILIKE '%{}%' OR COALESCE(azure_id, '') ILIKE '%{}%' OR location ILIKE '%{}%' OR COALESCE(vendor, '') ILIKE '%{}%' OR COALESCE(environment, '') ILIKE '%{}%')", 
                escaped_search, escaped_search, escaped_search, escaped_search, escaped_search, escaped_search
            ));
            tracing::info!("🔍 Search query added for: '{}' - will search in name, type, azure_id, location, vendor, environment", search);
        }

        if let Some(tags_search) = &filters.tags {
            // Parse tags search (format: "key:value,key2:value2" or "key:value")
            let tag_conditions: Vec<String> = tags_search
                .split(',')
                .filter_map(|tag_pair| {
                    let parts: Vec<&str> = tag_pair.trim().split(':').collect();
                    if parts.len() == 2 {
                        let key = parts[0].trim().replace("'", "''");
                        let value = parts[1].trim().replace("'", "''");
                        Some(format!("tags_json ? '{}' AND tags_json->>'{}'::text ILIKE '%{}%'", key, key, value))
                    } else {
                        None
                    }
                })
                .collect();
            
            if !tag_conditions.is_empty() {
                where_conditions.push(format!("({})", tag_conditions.join(" OR ")));
            }
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

        // Get paginated results with search relevance ordering
        let query = if filters.search.is_some() {
            let escaped_search = filters.search.as_ref().unwrap().replace("'", "''");
            format!(
                r#"
                SELECT id, azure_id, name, type, kind, location, subscription_id, resource_group_id,
                       tags_json, extended_location, vendor, environment, provisioner, created_at, updated_at
                FROM resource {}
                ORDER BY 
                    CASE 
                        WHEN name ILIKE '{}' THEN 1
                        WHEN name ILIKE '{}%' THEN 2
                        WHEN name ILIKE '%{}%' THEN 3
                        ELSE 4
                    END,
                    {} {}
                LIMIT {} OFFSET {}
                "#,
                where_clause, escaped_search, escaped_search, escaped_search, sort_field, sort_direction, size, offset
            )
        } else {
            format!(
                r#"
                SELECT id, azure_id, name, type, kind, location, subscription_id, resource_group_id,
                       tags_json, extended_location, vendor, environment, provisioner, created_at, updated_at
                FROM resource {}
                ORDER BY {} {}
                LIMIT {} OFFSET {}
                "#,
                where_clause, sort_field, sort_direction, size, offset
            )
        };

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
        let sql = "SELECT type, COUNT(*) as count FROM resource GROUP BY type ORDER BY count DESC";
        tracing::info!("📊 Executing UNFILTERED count_by_type SQL: {}", sql);
        
        let rows = sqlx::query(sql)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| DomainError::database_error(format!("Failed to count by type: {}", e)))?;

        Ok(rows.into_iter().map(|row| (row.get("type"), row.get("count"))).collect())
    }

    async fn count_by_location(&self) -> DomainResult<Vec<(String, i64)>> {
        let sql = "SELECT location, COUNT(*) as count FROM resource GROUP BY location ORDER BY count DESC";
        tracing::info!("📊 Executing UNFILTERED count_by_location SQL: {}", sql);
        
        let rows = sqlx::query(sql)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| DomainError::database_error(format!("Failed to count by location: {}", e)))?;

        Ok(rows.into_iter().map(|row| (row.get("location"), row.get("count"))).collect())
    }

    async fn count_by_environment(&self) -> DomainResult<Vec<(String, i64)>> {
        let sql = "SELECT COALESCE(environment, 'Unknown') as env, COUNT(*) as count FROM resource GROUP BY environment ORDER BY count DESC";
        tracing::info!("📊 Executing UNFILTERED count_by_environment SQL: {}", sql);
        
        let rows = sqlx::query(sql)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| DomainError::database_error(format!("Failed to count by environment: {}", e)))?;

        Ok(rows.into_iter().map(|row| (row.get("env"), row.get("count"))).collect())
    }

    // Filtered count methods for dashboard
    async fn count_by_type_filtered(&self, subscription_id: Option<i64>, resource_group_id: Option<i64>, location: Option<&str>, environment: Option<&str>) -> DomainResult<Vec<(String, i64)>> {
        let mut query = "SELECT type, COUNT(*) as count FROM resource WHERE 1=1".to_string();
        
        if let Some(sub_id) = subscription_id {
            query.push_str(&format!(" AND subscription_id = {}", sub_id));
        }
        if let Some(rg_id) = resource_group_id {
            query.push_str(&format!(" AND resource_group_id = {}", rg_id));
        }
        if let Some(loc) = location {
            query.push_str(&format!(" AND location = '{}'", loc));
        }
        if let Some(env) = environment {
            query.push_str(&format!(" AND environment = '{}'", env));
        }
        
        query.push_str(" GROUP BY type ORDER BY count DESC");

        tracing::info!("🔍 Executing filtered count_by_type SQL: {}", query);
        tracing::info!("📊 With subscription_id: {:?}, resource_group_id: {:?}, location: {:?}, environment: {:?}", 
                      subscription_id, resource_group_id, location, environment);

        let rows = sqlx::query(&query)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| DomainError::database_error(format!("Failed to count by type filtered: {}", e)))?;

        Ok(rows.into_iter().map(|row| (row.get("type"), row.get("count"))).collect())
    }

    async fn count_by_location_filtered(&self, subscription_id: Option<i64>, resource_group_id: Option<i64>, environment: Option<&str>) -> DomainResult<Vec<(String, i64)>> {
        let mut query = "SELECT location, COUNT(*) as count FROM resource WHERE 1=1".to_string();
        
        if let Some(sub_id) = subscription_id {
            query.push_str(&format!(" AND subscription_id = {}", sub_id));
        }
        if let Some(rg_id) = resource_group_id {
            query.push_str(&format!(" AND resource_group_id = {}", rg_id));
        }
        if let Some(env) = environment {
            query.push_str(&format!(" AND environment = '{}'", env));
        }
        
        query.push_str(" GROUP BY location ORDER BY count DESC");
        
        tracing::info!("🔍 Executing filtered count_by_location SQL: {}", query);

        let rows = sqlx::query(&query)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| DomainError::database_error(format!("Failed to count by location filtered: {}", e)))?;

        Ok(rows.into_iter().map(|row| (row.get("location"), row.get("count"))).collect())
    }

    async fn count_by_environment_filtered(&self, subscription_id: Option<i64>, resource_group_id: Option<i64>, location: Option<&str>) -> DomainResult<Vec<(String, i64)>> {
        let mut query = "SELECT COALESCE(environment, 'Unknown') as env, COUNT(*) as count FROM resource WHERE 1=1".to_string();
        
        if let Some(sub_id) = subscription_id {
            query.push_str(&format!(" AND subscription_id = {}", sub_id));
        }
        if let Some(rg_id) = resource_group_id {
            query.push_str(&format!(" AND resource_group_id = {}", rg_id));
        }
        if let Some(loc) = location {
            query.push_str(&format!(" AND location = '{}'", loc));
        }
        
        query.push_str(" GROUP BY environment ORDER BY count DESC");
        
        tracing::info!("🔍 Executing filtered count_by_environment SQL: {}", query);

        let rows = sqlx::query(&query)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| DomainError::database_error(format!("Failed to count by environment filtered: {}", e)))?;

        Ok(rows.into_iter().map(|row| (row.get("env"), row.get("count"))).collect())
    }

    async fn get_distinct_resource_types(&self) -> DomainResult<Vec<String>> {
        let rows = sqlx::query("SELECT DISTINCT type as resource_type FROM resource WHERE type IS NOT NULL ORDER BY type")
            .fetch_all(&self.pool)
            .await
            .map_err(|e| DomainError::database_error(format!("Failed to get distinct resource types: {}", e)))?;

        Ok(rows.into_iter().map(|row| row.get("resource_type")).collect())
    }
}
