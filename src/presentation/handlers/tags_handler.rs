use actix_web::{web, HttpResponse};
use std::sync::Arc;
use std::collections::HashMap;
use serde::{Deserialize, Serialize};

use crate::{
    application::services::AppServices,
    shared::errors::AppResult,
    presentation::responses::ApiResponse,
};

#[derive(Debug, Serialize, Deserialize)]
pub struct TagsResponse {
    pub tags: HashMap<String, Vec<String>>,
    pub popular_tags: Vec<TagUsage>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TagUsage {
    pub key: String,
    pub value: String,
    pub count: i64,
}

pub async fn get_available_tags(
    services: web::Data<Arc<AppServices>>,
) -> AppResult<HttpResponse> {
    // Get all unique tags from resources
    let resources = services.resource_use_cases.list_all_resources().await?;
    
    let mut tags_map: HashMap<String, std::collections::HashSet<String>> = HashMap::new();
    let mut tag_usage: HashMap<String, i64> = HashMap::new();
    
    // Process all resources to extract tags
    for resource in resources {
        if let Ok(tags_obj) = serde_json::from_value::<HashMap<String, String>>(resource.tags_json.clone()) {
            for (key, value) in tags_obj {
                // Add to tags map
                tags_map.entry(key.clone())
                    .or_insert_with(std::collections::HashSet::new)
                    .insert(value.clone());
                
                // Count usage
                let tag_pair = format!("{}:{}", key, value);
                *tag_usage.entry(tag_pair).or_insert(0) += 1;
            }
        }
    }
    
    // Convert HashSet to Vec for serialization
    let tags: HashMap<String, Vec<String>> = tags_map
        .into_iter()
        .map(|(k, v)| (k, v.into_iter().collect()))
        .collect();
    
    // Get popular tags (top 20)
    let mut popular_tags: Vec<TagUsage> = tag_usage
        .into_iter()
        .map(|(tag_pair, count)| {
            let parts: Vec<&str> = tag_pair.splitn(2, ':').collect();
            TagUsage {
                key: parts[0].to_string(),
                value: parts.get(1).unwrap_or(&"").to_string(),
                count,
            }
        })
        .collect();
    
    popular_tags.sort_by(|a, b| b.count.cmp(&a.count));
    popular_tags.truncate(20);
    
    let response = TagsResponse {
        tags,
        popular_tags,
    };
    
    Ok(HttpResponse::Ok().json(ApiResponse::success(response)))
}

pub async fn get_tag_suggestions(
    services: web::Data<Arc<AppServices>>,
    query: web::Query<TagSuggestionQuery>,
) -> AppResult<HttpResponse> {
    let search_term = query.q.as_deref().unwrap_or("").to_lowercase();
    
    // Get all resources and extract matching tags
    let resources = services.resource_use_cases.list_all_resources().await?;
    
    let mut suggestions: Vec<TagSuggestion> = Vec::new();
    let mut seen_tags: std::collections::HashSet<String> = std::collections::HashSet::new();
    
    for resource in resources {
        if let Ok(tags_obj) = serde_json::from_value::<HashMap<String, String>>(resource.tags_json.clone()) {
            for (key, value) in tags_obj {
                let key_lower = key.to_lowercase();
                let value_lower = value.to_lowercase();
                let tag_pair = format!("{}:{}", key, value);
                
                if !seen_tags.contains(&tag_pair) &&
                   (key_lower.contains(&search_term) || value_lower.contains(&search_term)) {
                    suggestions.push(TagSuggestion {
                        key: key.clone(),
                        value: value.clone(),
                        display: format!("{}:{}", key, value),
                    });
                    seen_tags.insert(tag_pair);
                }
            }
        }
    }
    
    // Sort by relevance (exact matches first, then partial matches)
    suggestions.sort_by(|a, b| {
        let a_exact = a.key.to_lowercase() == search_term || a.value.to_lowercase() == search_term;
        let b_exact = b.key.to_lowercase() == search_term || b.value.to_lowercase() == search_term;
        
        match (a_exact, b_exact) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.display.cmp(&b.display),
        }
    });
    
    // Limit results
    suggestions.truncate(10);
    
    Ok(HttpResponse::Ok().json(ApiResponse::success(suggestions)))
}

#[derive(Debug, Deserialize)]
pub struct TagSuggestionQuery {
    pub q: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct TagSuggestion {
    pub key: String,
    pub value: String,
    pub display: String,
}
