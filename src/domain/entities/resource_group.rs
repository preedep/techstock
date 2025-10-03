use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceGroup {
    pub id: i64,
    pub name: String,
    pub subscription_id: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateResourceGroupRequest {
    pub name: String,
    pub subscription_id: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateResourceGroupRequest {
    pub name: Option<String>,
    pub subscription_id: Option<i64>,
}

impl ResourceGroup {
    pub fn new(request: CreateResourceGroupRequest) -> Self {
        Self {
            id: 0, // Will be set by database
            name: request.name,
            subscription_id: request.subscription_id,
        }
    }

    pub fn update(&mut self, request: UpdateResourceGroupRequest) {
        if let Some(name) = request.name {
            self.name = name;
        }
        if let Some(subscription_id) = request.subscription_id {
            self.subscription_id = subscription_id;
        }
    }
}
