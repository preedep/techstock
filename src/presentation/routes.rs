use actix_web::{web, App, middleware::DefaultHeaders};
use actix_cors::Cors;
use actix_files::Files;
use std::sync::Arc;

use crate::{
    application::services::AppServices,
    infrastructure::database::Database,
    presentation::handlers::*,
};

pub fn configure_routes(cfg: &mut web::ServiceConfig) {
    cfg
        // Health endpoints
        .route("/health", web::get().to(health_check))
        .route("/stats", web::get().to(get_stats))
        
        // Resource endpoints
        .service(
            web::scope("/api/v1/resources")
                .route("", web::post().to(create_resource))
                .route("", web::get().to(list_resources))
                .route("/stats", web::get().to(get_resource_statistics))
                .route("/{id}", web::get().to(get_resource))
                .route("/{id}", web::put().to(update_resource))
                .route("/{id}", web::delete().to(delete_resource))
        )
        
        // Subscription endpoints
        .service(
            web::scope("/api/v1/subscriptions")
                .route("", web::post().to(create_subscription))
                .route("", web::get().to(list_subscriptions))
                .route("/{id}", web::get().to(get_subscription))
                .route("/{id}", web::put().to(update_subscription))
                .route("/{id}", web::delete().to(delete_subscription))
                .route("/{id}/resources", web::get().to(get_resources_by_subscription))
        )
        
        // Tags endpoints
        .service(
            web::scope("/api/v1/tags")
                .route("", web::get().to(get_available_tags))
                .route("/suggestions", web::get().to(get_tag_suggestions))
        );
}

pub fn create_app(
    services: Arc<AppServices>, 
    database: Arc<Database>
) -> App<
    impl actix_web::dev::ServiceFactory<
        actix_web::dev::ServiceRequest,
        Config = (),
        Response = actix_web::dev::ServiceResponse<actix_web::body::EitherBody<actix_web::body::BoxBody>>,
        Error = actix_web::Error,
        InitError = (),
    >,
> {
    App::new()
        .app_data(web::Data::new(services))
        .app_data(web::Data::new(database))
        .wrap(
            Cors::default()
                .allow_any_origin()
                .allow_any_method()
                .allow_any_header()
        )
        .wrap(
            DefaultHeaders::new()
                .add(("Cache-Control", "no-cache, no-store, must-revalidate"))
                .add(("Pragma", "no-cache"))
                .add(("Expires", "0"))
        )
        .configure(configure_routes)
        .service(Files::new("/", "./static").index_file("index.html"))
}
