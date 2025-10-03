use crate::{
    application::dto::*,
    domain::{
        repositories::{ResourceRepository, SubscriptionRepository, ResourceGroupRepository},
        errors::DomainResult,
        value_objects::ResourceFilters,
    },
};
use std::sync::Arc;

pub struct DashboardUseCases {
    resource_repository: Arc<dyn ResourceRepository>,
    subscription_repository: Arc<dyn SubscriptionRepository>,
    resource_group_repository: Arc<dyn ResourceGroupRepository>,
}

impl DashboardUseCases {
    pub fn new(
        resource_repository: Arc<dyn ResourceRepository>,
        subscription_repository: Arc<dyn SubscriptionRepository>,
        resource_group_repository: Arc<dyn ResourceGroupRepository>,
    ) -> Self {
        Self {
            resource_repository,
            subscription_repository,
            resource_group_repository,
        }
    }

    pub async fn get_dashboard_summary(
        &self,
        filters: Option<DashboardFiltersDto>,
    ) -> DomainResult<DashboardSummaryResponse> {
        // Build resource filters from dashboard filters (for future use)
        let _resource_filters = if let Some(f) = filters {
            ResourceFilters {
                resource_type: None,
                location: None,
                environment: f.environment,
                vendor: None,
                subscription_id: f.subscription_id,
                resource_group_id: f.resource_group_id,
                search: None,
                tags: None,
            }
        } else {
            ResourceFilters::default()
        };

        // Get aggregated data using optimized queries
        let resource_type_counts = self.resource_repository.count_by_type().await?;
        let location_counts = self.resource_repository.count_by_location().await?;
        let environment_counts = self.resource_repository.count_by_environment().await?;

        // Get total counts
        let total_resources = resource_type_counts.iter().map(|(_, count)| *count as u64).sum();
        let total_subscriptions = self.subscription_repository.count_all().await? as u64;
        let total_resource_groups = self.resource_group_repository.count_all().await? as u64;
        let total_locations = location_counts.len() as u64;

        // Convert to summary format with percentages
        let resource_types = resource_type_counts
            .into_iter()
            .map(|(resource_type, count)| {
                let percentage = if total_resources > 0 {
                    (count as f32 / total_resources as f32) * 100.0
                } else {
                    0.0
                };
                ResourceTypeSummary {
                    resource_type,
                    count: count as u64,
                    percentage,
                }
            })
            .collect();

        let locations = location_counts
            .into_iter()
            .map(|(location, count)| {
                let percentage = if total_resources > 0 {
                    (count as f32 / total_resources as f32) * 100.0
                } else {
                    0.0
                };
                LocationSummary {
                    location,
                    count: count as u64,
                    percentage,
                }
            })
            .collect();

        let environments = environment_counts
            .into_iter()
            .map(|(environment, count)| {
                let percentage = if total_resources > 0 {
                    (count as f32 / total_resources as f32) * 100.0
                } else {
                    0.0
                };
                EnvironmentSummary {
                    environment,
                    count: count as u64,
                    percentage,
                }
            })
            .collect();

        // Mock health summary (in real implementation, this would come from monitoring data)
        let health_summary = HealthSummary {
            healthy: (total_resources as f64 * 0.85) as u64,
            warning: (total_resources as f64 * 0.10) as u64,
            critical: (total_resources as f64 * 0.05) as u64,
        };

        // Mock cost summary (in real implementation, this would come from billing APIs)
        let estimated_monthly_cost = total_resources as f64 * 12.50; // $12.50 per resource average
        let top_cost_driver = if total_resources > 0 {
            "Virtual Machines".to_string()
        } else {
            "N/A".to_string()
        };

        let cost_summary = CostSummary {
            estimated_monthly_cost,
            top_cost_driver,
        };

        Ok(DashboardSummaryResponse {
            total_resources,
            total_subscriptions,
            total_resource_groups,
            total_locations,
            resource_types,
            locations,
            environments,
            health_summary,
            cost_summary,
        })
    }
}
