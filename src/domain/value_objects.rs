use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pagination {
    pub page: u32,
    pub size: u32,
    pub total: u64,
    pub total_pages: u32,
}

impl Pagination {
    pub fn new(page: u32, size: u32, total: u64) -> Self {
        let total_pages = ((total as f64) / (size as f64)).ceil() as u32;
        Self {
            page,
            size,
            total,
            total_pages,
        }
    }
    
    pub fn offset(&self) -> u64 {
        ((self.page - 1) * self.size) as u64
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginationParams {
    pub page: Option<u32>,
    pub size: Option<u32>,
}

impl Default for PaginationParams {
    fn default() -> Self {
        Self {
            page: Some(1),
            size: Some(20),
        }
    }
}

impl PaginationParams {
    pub fn page(&self) -> u32 {
        self.page.unwrap_or(1).max(1)
    }
    
    pub fn size(&self) -> u32 {
        self.size.unwrap_or(20).clamp(1, 100000)  // Increase max limit for dashboard
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ResourceFilters {
    pub resource_type: Option<String>,
    pub location: Option<String>,
    pub environment: Option<String>,
    pub vendor: Option<String>,
    pub subscription_id: Option<i64>,
    pub resource_group_id: Option<i64>,
    pub search: Option<String>,
    pub tags: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SortParams {
    pub field: Option<String>,
    pub direction: Option<SortDirection>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SortDirection {
    #[serde(rename = "asc")]
    Ascending,
    #[serde(rename = "desc")]
    Descending,
}

impl Default for SortDirection {
    fn default() -> Self {
        Self::Ascending
    }
}
