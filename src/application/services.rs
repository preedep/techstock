use std::sync::Arc;
use crate::application::use_cases::*;
use crate::domain::repositories::*;

pub struct AppServices {
    pub resource_use_cases: ResourceUseCases,
    pub subscription_use_cases: SubscriptionUseCases,
    pub resource_group_use_cases: ResourceGroupUseCases,
    pub application_use_cases: ApplicationUseCases,
}

impl AppServices {
    pub fn new(
        resource_repository: Arc<dyn ResourceRepository>,
        subscription_repository: Arc<dyn SubscriptionRepository>,
        resource_group_repository: Arc<dyn ResourceGroupRepository>,
        application_repository: Arc<dyn ApplicationRepository>,
    ) -> Self {
        Self {
            resource_use_cases: ResourceUseCases::new(resource_repository),
            subscription_use_cases: SubscriptionUseCases::new(subscription_repository.clone()),
            resource_group_use_cases: ResourceGroupUseCases::new(
                resource_group_repository,
                subscription_repository,
            ),
            application_use_cases: ApplicationUseCases::new(application_repository),
        }
    }
}
