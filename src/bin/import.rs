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
    log::debug!("Environment variables loaded from .env file");
    
    // Connect to database
    log::debug!("Attempting database connection...");
    let pool = PgPool::connect(&database_url).await?;
    log::info!("Database connection established successfully");
    
    // Run migrations/create tables if needed
    log::info!("Setting up database tables...");
    setup_database(&pool).await?;
    log::debug!("Database setup completed");
    
    // Import CSV data
    let csv_path = "datasets/AzureResourceGraphFormattedResults-Query.csv";
    log::info!("Starting CSV import from: {}", csv_path);
    
    import_csv_data(&pool, csv_path).await?;
    
    log::info!("Import completed successfully!");
    
    Ok(())
}

async fn setup_database(pool: &PgPool) -> Result<()> {
    // Read and execute the SQL schema
    log::debug!("Reading SQL schema from sql/create_tables.sql");
    let sql_content = tokio::fs::read_to_string("sql/create_tables.sql").await?;
    log::debug!("SQL schema file loaded, {} bytes", sql_content.len());
    
    // Split by semicolon and execute each statement
    let statements: Vec<&str> = sql_content.split(';').collect();
    log::debug!("Executing {} SQL statements", statements.len());
    
    for (i, statement) in statements.iter().enumerate() {
        let statement = statement.trim();
        if !statement.is_empty() && !statement.starts_with("--") {
            log::debug!("Executing SQL statement {}: {}", i + 1, statement.chars().take(50).collect::<String>());
            match sqlx::query(statement).execute(pool).await {
                Ok(_) => log::debug!("SQL statement {} executed successfully", i + 1),
                Err(e) => log::debug!("SQL statement {} failed (ignoring): {}", i + 1, e),
            }
        }
    }
    
    Ok(())
}

async fn import_csv_data(pool: &PgPool, csv_path: &str) -> Result<()> {
    log::debug!("Checking if CSV file exists: {}", csv_path);
    if !Path::new(csv_path).exists() {
        log::error!("CSV file not found: {}", csv_path);
        return Err(anyhow::anyhow!("CSV file not found: {}", csv_path));
    }
    log::debug!("CSV file found, initializing reader");
    
    let mut reader = ReaderBuilder::new()
        .has_headers(true)
        .from_path(csv_path)?;
    log::debug!("CSV reader initialized successfully");
    
    let mut subscription_cache: HashMap<String, i64> = HashMap::new();
    let mut resource_group_cache: HashMap<(String, i64), i64> = HashMap::new();
    let mut application_cache: HashMap<String, i64> = HashMap::new();
    log::debug!("Initialized caches for subscriptions, resource groups, and applications");
    
    let mut record_count = 0;
    
    for result in reader.deserialize() {
        let record: CsvRecord = result?;
        record_count += 1;
        
        if record_count % 100 == 0 {
            log::info!("Processed {} records", record_count);
            log::debug!("Cache stats - Subscriptions: {}, Resource Groups: {}, Applications: {}", 
                subscription_cache.len(), resource_group_cache.len(), application_cache.len());
        }
        
        if record_count % 10 == 0 {
            log::debug!("Processing record {}: {} ({})", record_count, record.name, record.resource_type);
        }
        
        // Parse tags
        log::debug!("Parsing tags for resource: {}", record.name);
        let parsed_tags = parse_tags(&record.tags)?;
        log::debug!("Parsed {} tags for resource: {}", parsed_tags.tags.len(), record.name);
        
        // Get or create subscription
        log::debug!("Getting/creating subscription: {}", record.subscription);
        let subscription_id = get_or_create_subscription(
            pool, 
            &record.subscription, 
            &mut subscription_cache
        ).await?;
        log::debug!("Subscription ID: {}", subscription_id);
        
        // Get or create resource group
        log::debug!("Getting/creating resource group: {}", record.resource_group);
        let resource_group_id = get_or_create_resource_group(
            pool,
            &record.resource_group,
            subscription_id,
            &mut resource_group_cache,
        ).await?;
        log::debug!("Resource group ID: {}", resource_group_id);
        
        // Get or create application if AppID exists
        let application_id = if let Some(app_id) = parsed_tags.tags.get("AppID") {
            log::debug!("Getting/creating application: {}", app_id);
            let app_id_result = get_or_create_application(
                pool,
                app_id,
                &parsed_tags,
                &mut application_cache,
            ).await?;
            log::debug!("Application ID: {}", app_id_result);
            Some(app_id_result)
        } else {
            log::debug!("No AppID found in tags for resource: {}", record.name);
            None
        };
        
        // Insert resource
        log::debug!("Inserting resource: {}", record.name);
        let resource_id = insert_resource(
            pool,
            &record,
            &parsed_tags,
            subscription_id,
            resource_group_id,
        ).await?;
        log::debug!("Resource inserted with ID: {}", resource_id);
        
        // Insert resource tags
        log::debug!("Inserting {} tags for resource ID: {}", parsed_tags.tags.len(), resource_id);
        insert_resource_tags(pool, resource_id, &parsed_tags).await?;
        log::debug!("Tags inserted successfully for resource ID: {}", resource_id);
        
        // Link resource to application if exists
        if let Some(app_id) = application_id {
            log::debug!("Linking resource {} to application {}", resource_id, app_id);
            link_resource_to_application(pool, resource_id, app_id).await?;
            log::debug!("Resource-application link created successfully");
        }
    }
    
    log::info!("Successfully imported {} records", record_count);
    Ok(())
}

fn parse_tags(tags_str: &str) -> Result<ParsedTags> {
    log::debug!("Parsing tags string: {}", tags_str.chars().take(100).collect::<String>());
    let tags_json: Value = if tags_str == "null" || tags_str.is_empty() {
        log::debug!("Empty or null tags, using empty object");
        serde_json::json!({})
    } else {
        match serde_json::from_str(tags_str) {
            Ok(json) => {
                log::debug!("Successfully parsed tags JSON");
                json
            }
            Err(e) => {
                log::warn!("Failed to parse tags JSON: {}, using empty object", e);
                serde_json::json!({})
            }
        }
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
        log::debug!("Found subscription '{}' in cache with ID: {}", name, id);
        return Ok(id);
    }
    log::debug!("Subscription '{}' not in cache, checking database", name);
    
    // Try to find existing subscription
    if let Ok(row) = sqlx::query("SELECT id FROM subscription WHERE name = $1")
        .bind(name)
        .fetch_one(pool)
        .await
    {
        let id: i64 = row.get("id");
        log::debug!("Found existing subscription '{}' with ID: {}", name, id);
        cache.insert(name.to_string(), id);
        return Ok(id);
    }
    log::debug!("Subscription '{}' not found, creating new one", name);
    
    // Create new subscription
    let row = sqlx::query("INSERT INTO subscription (name) VALUES ($1) RETURNING id")
        .bind(name)
        .fetch_one(pool)
        .await?;
    
    let id: i64 = row.get("id");
    log::info!("Created new subscription '{}' with ID: {}", name, id);
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
        log::debug!("Found resource group '{}' in cache with ID: {}", name, id);
        return Ok(id);
    }
    log::debug!("Resource group '{}' not in cache, checking database", name);
    
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
        log::debug!("Found existing resource group '{}' with ID: {}", name, id);
        cache.insert(key, id);
        return Ok(id);
    }
    log::debug!("Resource group '{}' not found, creating new one", name);
    
    // Create new resource group
    let row = sqlx::query(
        "INSERT INTO resource_group (name, subscription_id) VALUES ($1, $2) RETURNING id"
    )
    .bind(name)
    .bind(subscription_id)
    .fetch_one(pool)
    .await?;
    
    let id: i64 = row.get("id");
    log::info!("Created new resource group '{}' with ID: {}", name, id);
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
        log::debug!("Found application '{}' in cache with ID: {}", app_id, id);
        return Ok(id);
    }
    log::debug!("Application '{}' not in cache, checking database", app_id);
    
    // Try to find existing application
    if let Ok(row) = sqlx::query("SELECT id FROM application WHERE code = $1")
        .bind(app_id)
        .fetch_one(pool)
        .await
    {
        let id: i64 = row.get("id");
        log::debug!("Found existing application '{}' with ID: {}", app_id, id);
        cache.insert(app_id.to_string(), id);
        return Ok(id);
    }
    log::debug!("Application '{}' not found, creating new one", app_id);
    
    // Create new application
    let owner_email = parsed_tags.tags.get("AdminName")
        .or(parsed_tags.tags.get("AdminName1"))
        .or(parsed_tags.tags.get("AdminName2"));
    
    let app_name = parsed_tags.tags.get("AppName");
    log::debug!("Creating application - Code: {}, Name: {:?}, Owner: {:?}", app_id, app_name, owner_email);
    
    let row = sqlx::query(
        "INSERT INTO application (code, name, owner_email) VALUES ($1, $2, $3) RETURNING id"
    )
    .bind(app_id)
    .bind(app_name)
    .bind(owner_email)
    .fetch_one(pool)
    .await?;
    
    let id: i64 = row.get("id");
    log::info!("Created new application '{}' with ID: {}", app_id, id);
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
    log::debug!("Preparing to insert resource: {} (type: {}, location: {})", 
        record.name, record.resource_type, record.location);
    
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
    
    let vendor = parsed_tags.tags.get("Vendor");
    let environment = parsed_tags.tags.get("Environment");
    let provisioner = parsed_tags.tags.get("Provisioner");
    
    log::debug!("Resource metadata - Vendor: {:?}, Environment: {:?}, Provisioner: {:?}", 
        vendor, environment, provisioner);
    
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
    .bind(vendor)
    .bind(environment)
    .bind(provisioner)
    .fetch_one(pool)
    .await?;
    
    let resource_id = row.get("id");
    log::debug!("Resource '{}' inserted successfully with ID: {}", record.name, resource_id);
    Ok(resource_id)
}

async fn insert_resource_tags(
    pool: &PgPool,
    resource_id: i64,
    parsed_tags: &ParsedTags,
) -> Result<()> {
    let mut tag_count = 0;
    for (key, value) in &parsed_tags.tags {
        log::debug!("Inserting tag for resource {}: {} = {}", resource_id, key, value);
        match sqlx::query(
            "INSERT INTO resource_tag (resource_id, key, value) VALUES ($1, $2, $3)
             ON CONFLICT (resource_id, key) DO UPDATE SET value = EXCLUDED.value"
        )
        .bind(resource_id)
        .bind(key)
        .bind(Some(value))
        .execute(pool)
        .await {
            Ok(_) => {
                tag_count += 1;
                log::debug!("Tag '{}' inserted/updated successfully", key);
            }
            Err(e) => {
                log::warn!("Failed to insert tag '{}' for resource {}: {}", key, resource_id, e);
            }
        }
    }
    log::debug!("Inserted {} tags for resource {}", tag_count, resource_id);
    
    Ok(())
}

async fn link_resource_to_application(
    pool: &PgPool,
    resource_id: i64,
    application_id: i64,
) -> Result<()> {
    log::debug!("Creating resource-application link: resource {} -> application {}", resource_id, application_id);
    
    match sqlx::query(
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
    .await {
        Ok(_) => {
            log::debug!("Resource-application link created successfully");
        }
        Err(e) => {
            log::warn!("Failed to create resource-application link: {}", e);
            return Err(e.into());
        }
    }
    
    Ok(())
}