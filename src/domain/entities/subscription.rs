use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Subscription {
    pub id: i64,
    pub name: String,
    pub tenant_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSubscriptionRequest {
    pub name: String,
    pub tenant_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateSubscriptionRequest {
    pub name: Option<String>,
    pub tenant_id: Option<String>,
}

impl Subscription {
    pub fn new(request: CreateSubscriptionRequest) -> Self {
        Self {
            id: 0, // Will be set by database
            name: request.name,
            tenant_id: request.tenant_id,
        }
    }

    pub fn update(&mut self, request: UpdateSubscriptionRequest) {
        if let Some(name) = request.name {
            self.name = name;
        }
        if let Some(tenant_id) = request.tenant_id {
            self.tenant_id = Some(tenant_id);
        }
    }
}
