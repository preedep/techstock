use validator::ValidationErrors;
use crate::domain::errors::DomainError;

pub fn validate_dto<T: validator::Validate>(dto: &T) -> Result<(), DomainError> {
    dto.validate()
        .map_err(|e| DomainError::invalid_input(format_validation_errors(e)))
}

fn format_validation_errors(errors: ValidationErrors) -> String {
    let mut messages = Vec::new();
    
    for (field, field_errors) in errors.field_errors() {
        for error in field_errors {
            let message = error.message
                .as_ref()
                .map(|m| m.to_string())
                .unwrap_or_else(|| format!("Invalid value for field '{}'", field));
            messages.push(format!("{}: {}", field, message));
        }
    }
    
    messages.join(", ")
}
