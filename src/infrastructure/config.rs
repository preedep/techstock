use serde::Deserialize;
use std::env;

#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    pub database_url: String,
    pub server_host: String,
    pub server_port: u16,
    pub log_level: String,
    pub cors_origins: Vec<String>,
}

impl Config {
    pub fn from_env() -> Result<Self, env::VarError> {
        Ok(Self {
            database_url: env::var("DATABASE_URL")?,
            server_host: env::var("SERVER_HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
            server_port: env::var("SERVER_PORT")
                .unwrap_or_else(|_| "3000".to_string())
                .parse()
                .unwrap_or(3000),
            log_level: env::var("RUST_LOG").unwrap_or_else(|_| "info".to_string()),
            cors_origins: env::var("CORS_ORIGINS")
                .unwrap_or_else(|_| "*".to_string())
                .split(',')
                .map(|s| s.trim().to_string())
                .collect(),
        })
    }

    pub fn server_address(&self) -> String {
        format!("{}:{}", self.server_host, self.server_port)
    }
}
