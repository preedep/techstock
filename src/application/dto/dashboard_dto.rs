use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct DashboardSummaryResponse {
    pub total_resources: u64,
    pub total_subscriptions: u64,
    pub total_resource_groups: u64,
    pub total_locations: u64,
    pub resource_types: Vec<ResourceTypeSummary>,
    pub locations: Vec<LocationSummary>,
    pub environments: Vec<EnvironmentSummary>,
    pub health_summary: HealthSummary,
    pub cost_summary: CostSummary,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ResourceTypeSummary {
    pub resource_type: String,
    pub count: u64,
    pub percentage: f32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LocationSummary {
    pub location: String,
    pub count: u64,
    pub percentage: f32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EnvironmentSummary {
    pub environment: String,
    pub count: u64,
    pub percentage: f32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HealthSummary {
    pub healthy: u64,
    pub warning: u64,
    pub critical: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CostSummary {
    pub estimated_monthly_cost: f64,
    pub top_cost_driver: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DashboardFiltersDto {
    pub subscription_id: Option<i64>,
    pub resource_group_id: Option<i64>,
    pub environment: Option<String>,
    pub time_range: Option<String>,
}
