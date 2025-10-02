use anyhow::Result;
use csv::ReaderBuilder;
use serde::Deserialize;
use serde_json::Value;
use sqlx::{PgPool, Row};
use std::collections::HashMap;
use std::env;
use std::path::Path;

#[derive(Debug, Deserialize)]
struct CsvRecord {
    #[serde(rename = "Name")]
    name: String,
    #[serde(rename = "Type")]
    resource_type: String,
    #[serde(rename = "kind")]
    kind: Option<String>,
    #[serde(rename = "Location")]
    location: String,
    #[serde(rename = "Subscription")]
    subscription: String,
    #[serde(rename = "Resource group")]
    resource_group: String,
    #[serde(rename = "Tags")]
    tags: String,
    #[serde(rename = "extendedLocation")]
    extended_location: Option<String>,
}

#[derive(Debug, Clone)]
struct ParsedTags {
    tags: HashMap<String, String>,
    tags_json: Value,
}

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize logging
    pretty_env_logger::init();
    
    // Load environment variables
    dotenv::dotenv().ok();
    
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://localhost/techstock".to_string());
    
    log::info!("Connecting to database: {}", database_url);
    
    // Connect to database
    let pool = PgPool::connect(&database_url).await?;
    
    // Run migrations/create tables if needed
    log::info!("Setting up database tables...");
    setup_database(&pool).await?;
    
    // Import CSV data
    let csv_path = "datasets/AzureResourceGraphFormattedResults-Query.csv";
    log::info!("Starting CSV import from: {}", csv_path);
    
    import_csv_data(&pool, csv_path).await?;
    
    log::info!("Import completed successfully!");
    
    Ok(())
}

async fn setup_database(pool: &PgPool) -> Result<()> {
    // Read and execute the SQL schema
    let sql_content = tokio::fs::read_to_string("sql/create_tables.sql").await?;
    
    // Split by semicolon and execute each statement
    for statement in sql_content.split(';') {
        let statement = statement.trim();
        if !statement.is_empty() && !statement.starts_with("--") {
            sqlx::query(statement).execute(pool).await.ok(); // Ignore errors for existing tables
        }
    }
    
    Ok(())
}

async fn import_csv_data(pool: &PgPool, csv_path: &str) -> Result<()> {
    if !Path::new(csv_path).exists() {
        return Err(anyhow::anyhow!("CSV file not found: {}", csv_path));
    }
    
    let mut reader = ReaderBuilder::new()
        .has_headers(true)
        .from_path(csv_path)?;
    
    let mut subscription_cache: HashMap<String, i64> = HashMap::new();
    let mut resource_group_cache: HashMap<(String, i64), i64> = HashMap::new();
    let mut application_cache: HashMap<String, i64> = HashMap::new();
    
    let mut record_count = 0;
    
    for result in reader.deserialize() {
        let record: CsvRecord = result?;
        record_count += 1;
        
        if record_count % 100 == 0 {
            log::info!("Processed {} records", record_count);
        }
        
        // Parse tags
        let parsed_tags = parse_tags(&record.tags)?;
        
        // Get or create subscription
        let subscription_id = get_or_create_subscription(
            pool, 
            &record.subscription, 
            &mut subscription_cache
        ).await?;
        
        // Get or create resource group
        let resource_group_id = get_or_create_resource_group(
            pool,
            &record.resource_group,
            subscription_id,
            &mut resource_group_cache,
        ).await?;
        
        // Get or create application if AppID exists
        let application_id = if let Some(app_id) = parsed_tags.tags.get("AppID") {
            Some(get_or_create_application(
                pool,
                app_id,
                &parsed_tags,
                &mut application_cache,
            ).await?)
        } else {
            None
        };
        
        // Insert resource
        let resource_id = insert_resource(
            pool,
            &record,
            &parsed_tags,
            subscription_id,
            resource_group_id,
        ).await?;
        
        // Insert resource tags
        insert_resource_tags(pool, resource_id, &parsed_tags).await?;
        
        // Link resource to application if exists
        if let Some(app_id) = application_id {
            link_resource_to_application(pool, resource_id, app_id).await?;
        }
    }
    
    log::info!("Successfully imported {} records", record_count);
    Ok(())
}

fn parse_tags(tags_str: &str) -> Result<ParsedTags> {
    let tags_json: Value = if tags_str == "null" || tags_str.is_empty() {
        serde_json::json!({})
    } else {
        serde_json::from_str(tags_str)?
    };
    
    let mut tags = HashMap::new();
    
    if let Value::Object(map) = &tags_json {
        for (key, value) in map {
            if let Some(str_value) = value.as_str() {
                tags.insert(key.clone(), str_value.to_string());
            } else if !value.is_null() {
                tags.insert(key.clone(), value.to_string());
            }
        }
    }
    
    Ok(ParsedTags {
        tags,
        tags_json,
    })
}

async fn get_or_create_subscription(
    pool: &PgPool,
    name: &str,
    cache: &mut HashMap<String, i64>,
) -> Result<i64> {
    if let Some(&id) = cache.get(name) {
        return Ok(id);
    }
    
    // Try to find existing subscription
    if let Ok(row) = sqlx::query("SELECT id FROM subscription WHERE name = $1")
        .bind(name)
        .fetch_one(pool)
        .await
    {
        let id: i64 = row.get("id");
        cache.insert(name.to_string(), id);
        return Ok(id);
    }
    
    // Create new subscription
    let row = sqlx::query("INSERT INTO subscription (name) VALUES ($1) RETURNING id")
        .bind(name)
        .fetch_one(pool)
        .await?;
    
    let id: i64 = row.get("id");
    cache.insert(name.to_string(), id);
    Ok(id)
}

async fn get_or_create_resource_group(
    pool: &PgPool,
    name: &str,
    subscription_id: i64,
    cache: &mut HashMap<(String, i64), i64>,
) -> Result<i64> {
    let key = (name.to_string(), subscription_id);
    
    if let Some(&id) = cache.get(&key) {
        return Ok(id);
    }
    
    // Try to find existing resource group
    if let Ok(row) = sqlx::query(
        "SELECT id FROM resource_group WHERE name = $1 AND subscription_id = $2"
    )
    .bind(name)
    .bind(subscription_id)
    .fetch_one(pool)
    .await
    {
        let id: i64 = row.get("id");
        cache.insert(key, id);
        return Ok(id);
    }
    
    // Create new resource group
    let row = sqlx::query(
        "INSERT INTO resource_group (name, subscription_id) VALUES ($1, $2) RETURNING id"
    )
    .bind(name)
    .bind(subscription_id)
    .fetch_one(pool)
    .await?;
    
    let id: i64 = row.get("id");
    cache.insert(key, id);
    Ok(id)
}

async fn get_or_create_application(
    pool: &PgPool,
    app_id: &str,
    parsed_tags: &ParsedTags,
    cache: &mut HashMap<String, i64>,
) -> Result<i64> {
    if let Some(&id) = cache.get(app_id) {
        return Ok(id);
    }
    
    // Try to find existing application
    if let Ok(row) = sqlx::query("SELECT id FROM application WHERE code = $1")
        .bind(app_id)
        .fetch_one(pool)
        .await
    {
        let id: i64 = row.get("id");
        cache.insert(app_id.to_string(), id);
        return Ok(id);
    }
    
    // Create new application
    let owner_email = parsed_tags.tags.get("AdminName")
        .or(parsed_tags.tags.get("AdminName1"))
        .or(parsed_tags.tags.get("AdminName2"));
    
    let row = sqlx::query(
        "INSERT INTO application (code, name, owner_email) VALUES ($1, $2, $3) RETURNING id"
    )
    .bind(app_id)
    .bind(parsed_tags.tags.get("AppName"))
    .bind(owner_email)
    .fetch_one(pool)
    .await?;
    
    let id: i64 = row.get("id");
    cache.insert(app_id.to_string(), id);
    Ok(id)
}

async fn insert_resource(
    pool: &PgPool,
    record: &CsvRecord,
    parsed_tags: &ParsedTags,
    subscription_id: i64,
    resource_group_id: i64,
) -> Result<i64> {
    let extended_location = if record.extended_location.as_deref() == Some("null") {
        None
    } else {
        record.extended_location.as_deref()
    };
    
    let kind = if record.kind.as_deref() == Some("") {
        None
    } else {
        record.kind.as_deref()
    };
    
    let row = sqlx::query(
        r#"
        INSERT INTO resource (
            name, type, kind, location, subscription_id, resource_group_id,
            tags_json, extended_location, vendor, environment, provisioner
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
        "#
    )
    .bind(&record.name)
    .bind(&record.resource_type)
    .bind(kind)
    .bind(&record.location)
    .bind(subscription_id)
    .bind(resource_group_id)
    .bind(&parsed_tags.tags_json)
    .bind(extended_location)
    .bind(parsed_tags.tags.get("Vendor"))
    .bind(parsed_tags.tags.get("Environment"))
    .bind(parsed_tags.tags.get("Provisioner"))
    .fetch_one(pool)
    .await?;
    
    Ok(row.get("id"))
}

async fn insert_resource_tags(
    pool: &PgPool,
    resource_id: i64,
    parsed_tags: &ParsedTags,
) -> Result<()> {
    for (key, value) in &parsed_tags.tags {
        sqlx::query(
            "INSERT INTO resource_tag (resource_id, key, value) VALUES ($1, $2, $3)
             ON CONFLICT (resource_id, key) DO UPDATE SET value = EXCLUDED.value"
        )
        .bind(resource_id)
        .bind(key)
        .bind(Some(value))
        .execute(pool)
        .await?;
    }
    
    Ok(())
}

async fn link_resource_to_application(
    pool: &PgPool,
    resource_id: i64,
    application_id: i64,
) -> Result<()> {
    sqlx::query(
        r#"
        INSERT INTO resource_application_map (resource_id, application_id, relation_type)
        VALUES ($1, $2, 'uses')
        ON CONFLICT (resource_id, application_id, relation_type) DO NOTHING
        "#
    )
    .bind(resource_id)
    .bind(application_id)
    .bind("uses")
    .execute(pool)
    .await?;
    
    Ok(())
}