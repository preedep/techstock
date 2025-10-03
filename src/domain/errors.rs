use thiserror::Error;

#[derive(Error, Debug)]
pub enum DomainError {
    #[error("Entity not found: {entity} with id {id}")]
    NotFound { entity: String, id: String },
    
    #[error("Entity already exists: {entity} with {field} = {value}")]
    AlreadyExists { entity: String, field: String, value: String },
    
    #[error("Invalid input: {message}")]
    InvalidInput { message: String },
    
    #[error("Business rule violation: {message}")]
    BusinessRuleViolation { message: String },
    
    #[error("Database error: {message}")]
    DatabaseError { message: String },
    
    #[error("Internal error: {message}")]
    InternalError { message: String },
}

impl DomainError {
    pub fn not_found(entity: &str, id: impl ToString) -> Self {
        Self::NotFound {
            entity: entity.to_string(),
            id: id.to_string(),
        }
    }
    
    pub fn already_exists(entity: &str, field: &str, value: impl ToString) -> Self {
        Self::AlreadyExists {
            entity: entity.to_string(),
            field: field.to_string(),
            value: value.to_string(),
        }
    }
    
    pub fn invalid_input(message: impl ToString) -> Self {
        Self::InvalidInput {
            message: message.to_string(),
        }
    }
    
    pub fn business_rule_violation(message: impl ToString) -> Self {
        Self::BusinessRuleViolation {
            message: message.to_string(),
        }
    }
    
    pub fn database_error(message: impl ToString) -> Self {
        Self::DatabaseError {
            message: message.to_string(),
        }
    }
    
    pub fn internal_error(message: impl ToString) -> Self {
        Self::InternalError {
            message: message.to_string(),
        }
    }
}

pub type DomainResult<T> = Result<T, DomainError>;
