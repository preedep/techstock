use crate::{
    application::dto::*,
    domain::{
        repositories::{ResourceRepository, SubscriptionRepository, ResourceGroupRepository},
        errors::DomainResult,
        value_objects::ResourceFilters,
    },
};
use std::{sync::Arc, collections::HashMap};

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
        let _resource_filters = if let Some(ref f) = filters {
            ResourceFilters {
                resource_type: None,
                location: None,
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
            // Apply filters to get filtered counts
            self.get_filtered_resource_type_counts(filters).await?
        } else {
            self.resource_repository.count_by_type().await?
        };
        
        let location_counts = if let Some(ref filters) = filters {
            self.get_filtered_location_counts(filters).await?
        } else {
            self.resource_repository.count_by_location().await?
        };
        
        let environment_counts = if let Some(ref filters) = filters {
            self.get_filtered_environment_counts(filters).await?
        } else {
            self.resource_repository.count_by_environment().await?
        };

        // Get total counts (filtered or unfiltered)
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

    async fn get_filtered_resource_type_counts(
        &self,
        filters: &DashboardFiltersDto,
    ) -> DomainResult<Vec<(String, i64)>> {
        // For now, use the existing count_by_type and filter in memory
        // In production, you'd want to add filtered count methods to the repository
        let all_counts = self.resource_repository.count_by_type().await?;
        
        // If we have subscription or resource group filters, we need to get filtered data
        if filters.subscription_id.is_some() || filters.resource_group_id.is_some() {
            // This is a simplified approach - in production you'd want optimized SQL queries
            let resource_filters = ResourceFilters {
                resource_type: None,
                location: None,
                environment: filters.environment.clone(),
                vendor: None,
                subscription_id: filters.subscription_id,
                resource_group_id: filters.resource_group_id,
                search: None,
                tags: None,
            };
            
            // Get filtered resources and count by type
            // Note: This is not optimal for large datasets - should be done in SQL
            let (filtered_resources, _) = self.resource_repository.find_all(
                crate::domain::value_objects::PaginationParams {
                    page: Some(1),
                    size: Some(100000), // Large number to get all
                },
                resource_filters,
                crate::domain::value_objects::SortParams {
                    field: Some("created_at".to_string()),
                    direction: Some(crate::domain::value_objects::SortDirection::Descending),
                },
            ).await?;
            
            // Count by type from filtered results
            let mut type_counts = HashMap::new();
            for resource in filtered_resources {
                let resource_type = resource.resource_type;
                *type_counts.entry(resource_type).or_insert(0) += 1;
            }
            
            let mut result: Vec<(String, i64)> = type_counts.into_iter().collect();
            result.sort_by(|a, b| b.1.cmp(&a.1)); // Sort by count descending
            Ok(result)
        } else {
            Ok(all_counts)
        }
    }

    async fn get_filtered_location_counts(
        &self,
        filters: &DashboardFiltersDto,
    ) -> DomainResult<Vec<(String, i64)>> {
        if filters.subscription_id.is_some() || filters.resource_group_id.is_some() {
            // Similar implementation as above for locations
            let resource_filters = ResourceFilters {
                resource_type: None,
                location: None,
                environment: filters.environment.clone(),
                vendor: None,
                subscription_id: filters.subscription_id,
                resource_group_id: filters.resource_group_id,
                search: None,
                tags: None,
            };
            
            let (filtered_resources, _) = self.resource_repository.find_all(
                crate::domain::value_objects::PaginationParams {
                    page: Some(1),
                    size: Some(100000),
                },
                resource_filters,
                crate::domain::value_objects::SortParams {
                    field: Some("created_at".to_string()),
                    direction: Some(crate::domain::value_objects::SortDirection::Descending),
                },
            ).await?;
            
            let mut location_counts = HashMap::new();
            for resource in filtered_resources {
                let location = resource.location;
                *location_counts.entry(location).or_insert(0) += 1;
            }
            
            let mut result: Vec<(String, i64)> = location_counts.into_iter().collect();
            result.sort_by(|a, b| b.1.cmp(&a.1));
            Ok(result)
        } else {
            self.resource_repository.count_by_location().await
        }
    }

    async fn get_filtered_environment_counts(
        &self,
        filters: &DashboardFiltersDto,
    ) -> DomainResult<Vec<(String, i64)>> {
        if filters.subscription_id.is_some() || filters.resource_group_id.is_some() {
            let resource_filters = ResourceFilters {
                resource_type: None,
                location: None,
                environment: filters.environment.clone(),
                vendor: None,
                subscription_id: filters.subscription_id,
                resource_group_id: filters.resource_group_id,
                search: None,
                tags: None,
            };
            
            let (filtered_resources, _) = self.resource_repository.find_all(
                crate::domain::value_objects::PaginationParams {
                    page: Some(1),
                    size: Some(100000),
                },
                resource_filters,
                crate::domain::value_objects::SortParams {
                    field: Some("created_at".to_string()),
                    direction: Some(crate::domain::value_objects::SortDirection::Descending),
                },
            ).await?;
            
            let mut env_counts = HashMap::new();
            for resource in filtered_resources {
                let environment = resource.environment.unwrap_or_else(|| "Unknown".to_string());
                *env_counts.entry(environment).or_insert(0) += 1;
            }
            
            let mut result: Vec<(String, i64)> = env_counts.into_iter().collect();
            result.sort_by(|a, b| b.1.cmp(&a.1));
            Ok(result)
        } else {
            self.resource_repository.count_by_environment().await
        }
    }
}
