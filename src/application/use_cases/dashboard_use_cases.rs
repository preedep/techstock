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
        // Debug: Log received filters in use case
        tracing::info!("📊 Dashboard use case received filters: {:?}", filters);
        
        // Build resource filters from dashboard filters (for future use)
        let _resource_filters = if let Some(ref f) = filters {
            ResourceFilters {
                resource_type: None,
                location: f.location.clone(),
                environment: f.environment.clone(),
                vendor: None,
                subscription_id: f.subscription_id,
                resource_group_id: f.resource_group_id,
                search: None,
                tags: None,
            }
        } else {
            ResourceFilters::default()
        };

        // Get aggregated data using optimized queries with filters
        let resource_type_counts = if let Some(ref filters) = filters {
            // Check if any filters are actually set (not just empty/None values)
            let has_filters = filters.subscription_id.is_some() || 
                             filters.resource_group_id.is_some() || 
                             filters.location.is_some() || 
                             filters.environment.is_some();
            
            if has_filters {
                tracing::info!("🔍 Using filtered resource type counts with filters: {:?}", filters);
                self.get_filtered_resource_type_counts(filters).await?
            } else {
                tracing::info!("📊 Using unfiltered resource type counts (no active filters)");
                self.resource_repository.count_by_type().await?
            }
        } else {
            tracing::info!("📊 Using unfiltered resource type counts (no filters provided)");
            self.resource_repository.count_by_type().await?
        };
        
        let location_counts = if let Some(ref filters) = filters {
            let has_filters = filters.subscription_id.is_some() || 
                             filters.resource_group_id.is_some() || 
                             filters.location.is_some() || 
                             filters.environment.is_some();
            
            if has_filters {
                tracing::info!("🔍 Using filtered location counts");
                self.get_filtered_location_counts(filters).await?
            } else {
                tracing::info!("📊 Using unfiltered location counts");
                self.resource_repository.count_by_location().await?
            }
        } else {
            self.resource_repository.count_by_location().await?
        };
        
        let environment_counts = if let Some(ref filters) = filters {
            let has_filters = filters.subscription_id.is_some() || 
                             filters.resource_group_id.is_some() || 
                             filters.location.is_some() || 
                             filters.environment.is_some();
            
            if has_filters {
                tracing::info!("🔍 Using filtered environment counts");
                self.get_filtered_environment_counts(filters).await?
            } else {
                tracing::info!("📊 Using unfiltered environment counts");
                self.resource_repository.count_by_environment().await?
            }
        } else {
            self.resource_repository.count_by_environment().await?
        };

        // Get total counts (filtered or unfiltered)
        let total_resources = resource_type_counts.iter().map(|(_, count)| *count as u64).sum();
        
        // Calculate filtered totals
        let (total_subscriptions, total_resource_groups) = if let Some(ref filters) = filters {
            let has_filters = filters.subscription_id.is_some() || 
                             filters.resource_group_id.is_some() || 
                             filters.location.is_some() || 
                             filters.environment.is_some();
            
            if has_filters {
                tracing::info!("🔍 Using filtered totals");
                self.get_filtered_totals(filters).await?
            } else {
                tracing::info!("📊 Using unfiltered totals");
                (
                    self.subscription_repository.count_all().await? as u64,
                    self.resource_group_repository.count_all().await? as u64,
                )
            }
        } else {
            (
                self.subscription_repository.count_all().await? as u64,
                self.resource_group_repository.count_all().await? as u64,
            )
        };
        
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

    async fn get_filtered_resource_type_counts(
        &self,
        filters: &DashboardFiltersDto,
    ) -> DomainResult<Vec<(String, i64)>> {
        // Use optimized SQL queries with WHERE clauses
        self.resource_repository.count_by_type_filtered(
            filters.subscription_id,
            filters.resource_group_id,
            filters.location.as_deref(),
            filters.environment.as_deref(),
        ).await
    }

    async fn get_filtered_location_counts(
        &self,
        filters: &DashboardFiltersDto,
    ) -> DomainResult<Vec<(String, i64)>> {
        // Use optimized SQL queries with WHERE clauses
        self.resource_repository.count_by_location_filtered(
            filters.subscription_id,
            filters.resource_group_id,
            filters.environment.as_deref(),
        ).await
    }

    async fn get_filtered_environment_counts(
        &self,
        filters: &DashboardFiltersDto,
    ) -> DomainResult<Vec<(String, i64)>> {
        // Use optimized SQL queries with WHERE clauses
        self.resource_repository.count_by_environment_filtered(
            filters.subscription_id,
            filters.resource_group_id,
            filters.location.as_deref(),
        ).await
    }

    async fn get_filtered_totals(
        &self,
        filters: &DashboardFiltersDto,
    ) -> DomainResult<(u64, u64)> {
        let mut total_subscriptions = self.subscription_repository.count_all().await? as u64;
        let mut total_resource_groups = self.resource_group_repository.count_all().await? as u64;

        // If filtering by specific subscription, total subscriptions should be 1
        if filters.subscription_id.is_some() {
            total_subscriptions = 1;
        }

        // If filtering by specific resource group, total resource groups should be 1
        if filters.resource_group_id.is_some() {
            total_resource_groups = 1;
        }

        // If filtering by subscription but not resource group, count resource groups in that subscription
        if filters.subscription_id.is_some() && filters.resource_group_id.is_none() {
            let subscription_id = filters.subscription_id.unwrap();
            let resource_groups = self.resource_group_repository
                .find_by_subscription_id(subscription_id).await?;
            total_resource_groups = resource_groups.len() as u64;
        }

        Ok((total_subscriptions, total_resource_groups))
    }
}
