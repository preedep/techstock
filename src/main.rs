use std::sync::Arc;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use actix_web::{HttpServer, middleware::Logger};

use techstock::{
    application::services::AppServices,
    infrastructure::{
        config::Config,
        database::Database,
        repositories::*,
    },
    presentation::routes::create_app,
};

#[actix_web::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Load environment variables
    dotenv::dotenv().ok();

    // Load configuration
    let config = Config::from_env()?;

    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| format!("{}=debug,actix_web=info", env!("CARGO_CRATE_NAME")).into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Starting TechStock API server...");
    tracing::info!("Configuration loaded: {:?}", config);

    // Initialize database
    let database = Arc::new(Database::new().await?);
    tracing::info!("Database connection established");

    // Initialize repositories
    let resource_repository = Arc::new(PostgresResourceRepository::new(database.pool.clone()));
    let subscription_repository = Arc::new(PostgresSubscriptionRepository::new(database.pool.clone()));
    let resource_group_repository = Arc::new(PostgresResourceGroupRepository::new(database.pool.clone()));
    let application_repository = Arc::new(PostgresApplicationRepository::new(database.pool.clone()));

    // Initialize services
    let services = Arc::new(AppServices::new(
        resource_repository,
        subscription_repository,
        resource_group_repository,
        application_repository,
    ));

    tracing::info!("Services initialized");

    let server_address = config.server_address();
    tracing::info!("Server listening on {}", server_address);

    // Start server
    HttpServer::new(move || {
        create_app(services.clone(), database.clone())
            .wrap(Logger::default())
    })
    .bind(&server_address)?
    .run()
    .await?;

    Ok(())
}
