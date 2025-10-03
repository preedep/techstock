use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Application {
    pub id: i64,
    pub code: Option<String>,
    pub name: Option<String>,
    pub owner_team: Option<String>,
    pub owner_email: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateApplicationRequest {
    pub code: Option<String>,
    pub name: Option<String>,
    pub owner_team: Option<String>,
    pub owner_email: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateApplicationRequest {
    pub code: Option<String>,
    pub name: Option<String>,
    pub owner_team: Option<String>,
    pub owner_email: Option<String>,
}

impl Application {
    pub fn new(request: CreateApplicationRequest) -> Self {
        Self {
            id: 0, // Will be set by database
            code: request.code,
            name: request.name,
            owner_team: request.owner_team,
            owner_email: request.owner_email,
        }
    }

    pub fn update(&mut self, request: UpdateApplicationRequest) {
        if let Some(code) = request.code {
            self.code = Some(code);
        }
        if let Some(name) = request.name {
            self.name = Some(name);
        }
        if let Some(owner_team) = request.owner_team {
            self.owner_team = Some(owner_team);
        }
        if let Some(owner_email) = request.owner_email {
            self.owner_email = Some(owner_email);
        }
    }
}
