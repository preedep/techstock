use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Resource {
    pub id: i64,
    pub azure_id: Option<String>,
    pub name: String,
    pub resource_type: String,
    pub kind: Option<String>,
    pub location: String,
    pub subscription_id: i64,
    pub resource_group_id: i64,
    pub tags_json: Value,
    pub extended_location: Option<String>,
    pub vendor: Option<String>,
    pub environment: Option<String>,
    pub provisioner: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceTag {
    pub resource_id: i64,
    pub key: String,
    pub value: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateResourceRequest {
    pub azure_id: Option<String>,
    pub name: String,
    pub resource_type: String,
    pub kind: Option<String>,
    pub location: String,
    pub subscription_id: i64,
    pub resource_group_id: i64,
    pub tags: HashMap<String, String>,
    pub extended_location: Option<String>,
    pub vendor: Option<String>,
    pub environment: Option<String>,
    pub provisioner: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateResourceRequest {
    pub azure_id: Option<String>,
    pub name: Option<String>,
    pub resource_type: Option<String>,
    pub kind: Option<String>,
    pub location: Option<String>,
    pub subscription_id: Option<i64>,
    pub resource_group_id: Option<i64>,
    pub tags: Option<HashMap<String, String>>,
    pub extended_location: Option<String>,
    pub vendor: Option<String>,
    pub environment: Option<String>,
    pub provisioner: Option<String>,
}

impl Resource {
    pub fn new(request: CreateResourceRequest) -> Self {
        let now = Utc::now();
        let tags_json = serde_json::to_value(&request.tags).unwrap_or(Value::Object(Default::default()));
        
        Self {
            id: 0, // Will be set by database
            azure_id: request.azure_id,
            name: request.name,
            resource_type: request.resource_type,
            kind: request.kind,
            location: request.location,
            subscription_id: request.subscription_id,
            resource_group_id: request.resource_group_id,
            tags_json,
            extended_location: request.extended_location,
            vendor: request.vendor,
            environment: request.environment,
            provisioner: request.provisioner,
            created_at: now,
            updated_at: now,
        }
    }

    pub fn update(&mut self, request: UpdateResourceRequest) {
        if let Some(azure_id) = request.azure_id {
            self.azure_id = Some(azure_id);
        }
        if let Some(name) = request.name {
            self.name = name;
        }
        if let Some(resource_type) = request.resource_type {
            self.resource_type = resource_type;
        }
        if let Some(kind) = request.kind {
            self.kind = Some(kind);
        }
        if let Some(location) = request.location {
            self.location = location;
        }
        if let Some(subscription_id) = request.subscription_id {
            self.subscription_id = subscription_id;
        }
        if let Some(resource_group_id) = request.resource_group_id {
            self.resource_group_id = resource_group_id;
        }
        if let Some(tags) = request.tags {
            self.tags_json = serde_json::to_value(&tags).unwrap_or(Value::Object(Default::default()));
        }
        if let Some(extended_location) = request.extended_location {
            self.extended_location = Some(extended_location);
        }
        if let Some(vendor) = request.vendor {
            self.vendor = Some(vendor);
        }
        if let Some(environment) = request.environment {
            self.environment = Some(environment);
        }
        if let Some(provisioner) = request.provisioner {
            self.provisioner = Some(provisioner);
        }
        
        self.updated_at = Utc::now();
    }
}
