-- ===================================
-- TECHSTOCK DATABASE QUERY STATEMENTS
-- ===================================

-- 1) Basic Table Counts
-- =====================
SELECT 'subscriptions' as table_name, COUNT(*) as count FROM subscription
UNION ALL
SELECT 'resource_groups', COUNT(*) FROM resource_group
UNION ALL
SELECT 'applications', COUNT(*) FROM application
UNION ALL
SELECT 'resources', COUNT(*) FROM resource
UNION ALL
SELECT 'resource_tags', COUNT(*) FROM resource_tag
UNION ALL
SELECT 'resource_app_mappings', COUNT(*) FROM resource_application_map;

-- 2) Resources by Type
-- ===================
SELECT type, COUNT(*) as count
FROM resource
GROUP BY type
ORDER BY count DESC;

-- 3) Resources by Location
-- =======================
SELECT location, COUNT(*) as count
FROM resource
GROUP BY location
ORDER BY count DESC;

-- 4) Resources by Environment
-- ==========================
SELECT environment, COUNT(*) as count
FROM resource
WHERE environment IS NOT NULL
GROUP BY environment
ORDER BY count DESC;

-- 5) Resources by Vendor
-- =====================
SELECT vendor, COUNT(*) as count
FROM resource
WHERE vendor IS NOT NULL
GROUP BY vendor
ORDER BY count DESC;

-- 6) Applications with Resource Counts
-- ===================================
SELECT 
    a.code,
    a.name,
    a.owner_email,
    COUNT(ram.resource_id) as resource_count
FROM application a
LEFT JOIN resource_application_map ram ON a.id = ram.application_id
GROUP BY a.id, a.code, a.name, a.owner_email
ORDER BY resource_count DESC;

-- 7) Subscriptions with Resource Counts
-- =====================================
SELECT 
    s.name as subscription_name,
    COUNT(r.id) as resource_count,
    COUNT(DISTINCT rg.id) as resource_group_count
FROM subscription s
LEFT JOIN resource_group rg ON s.id = rg.subscription_id
LEFT JOIN resource r ON rg.id = r.resource_group_id
GROUP BY s.id, s.name
ORDER BY resource_count DESC;

-- 8) Most Common Tags
-- ==================
SELECT 
    key,
    COUNT(*) as usage_count,
    COUNT(DISTINCT value) as unique_values
FROM resource_tag
GROUP BY key
ORDER BY usage_count DESC
LIMIT 20;

-- 9) Resources with Specific Tag
-- ==============================
-- Example: Find all resources with AppID tag
SELECT 
    r.name,
    r.type,
    r.location,
    rt.value as app_id
FROM resource r
JOIN resource_tag rt ON r.id = rt.resource_id
WHERE rt.key = 'AppID'
ORDER BY rt.value, r.name;

-- 10) Resources without Applications
-- =================================
SELECT 
    r.id,
    r.name,
    r.type,
    r.location,
    s.name as subscription,
    rg.name as resource_group
FROM resource r
JOIN resource_group rg ON r.resource_group_id = rg.id
JOIN subscription s ON rg.subscription_id = s.id
LEFT JOIN resource_application_map ram ON r.id = ram.resource_id
WHERE ram.resource_id IS NULL
ORDER BY s.name, rg.name, r.name;

-- 11) Full Resource Details with Relationships
-- ============================================
SELECT 
    r.id,
    r.name as resource_name,
    r.type as resource_type,
    r.location,
    r.environment,
    r.vendor,
    s.name as subscription,
    rg.name as resource_group,
    a.code as app_code,
    a.name as app_name,
    a.owner_email
FROM resource r
JOIN resource_group rg ON r.resource_group_id = rg.id
JOIN subscription s ON rg.subscription_id = s.id
LEFT JOIN resource_application_map ram ON r.id = ram.resource_id
LEFT JOIN application a ON ram.application_id = a.id
ORDER BY s.name, rg.name, r.name;

-- 12) Resources by Application
-- ===========================
-- Example: Find all resources for a specific application
SELECT 
    r.name as resource_name,
    r.type,
    r.location,
    r.environment,
    s.name as subscription,
    rg.name as resource_group
FROM resource r
JOIN resource_group rg ON r.resource_group_id = rg.id
JOIN subscription s ON rg.subscription_id = s.id
JOIN resource_application_map ram ON r.id = ram.resource_id
JOIN application a ON ram.application_id = a.id
WHERE a.code = 'AP2411'  -- Replace with actual AppID
ORDER BY r.type, r.name;

-- 13) Search Resources by Tag Value
-- =================================
-- Example: Find resources with specific tag values
SELECT DISTINCT
    r.name,
    r.type,
    r.location,
    rt.key as tag_key,
    rt.value as tag_value
FROM resource r
JOIN resource_tag rt ON r.id = rt.resource_id
WHERE rt.value ILIKE '%production%'  -- Replace with search term
ORDER BY r.name;

-- 14) JSON Tag Queries
-- ====================
-- Find resources with specific JSON tag properties
SELECT 
    name,
    type,
    location,
    tags_json
FROM resource
WHERE tags_json->>'Environment' = 'PRD'
   OR tags_json->>'AppID' IS NOT NULL
ORDER BY name;

-- 15) Resource Summary by Environment and Type
-- ===========================================
SELECT 
    COALESCE(environment, 'Unknown') as environment,
    type,
    COUNT(*) as count
FROM resource
GROUP BY ROLLUP(environment, type)
ORDER BY environment NULLS LAST, count DESC;

-- 16) Latest Resources Added
-- =========================
SELECT 
    r.name,
    r.type,
    r.location,
    s.name as subscription,
    r.created_at
FROM resource r
JOIN resource_group rg ON r.resource_group_id = rg.id
JOIN subscription s ON rg.subscription_id = s.id
ORDER BY r.created_at DESC
LIMIT 20;

-- 17) Duplicate Resource Names
-- ============================
SELECT 
    name,
    COUNT(*) as duplicate_count
FROM resource
GROUP BY name
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 18) Resources with Most Tags
-- ============================
SELECT 
    r.name,
    r.type,
    COUNT(rt.key) as tag_count
FROM resource r
LEFT JOIN resource_tag rt ON r.id = rt.resource_id
GROUP BY r.id, r.name, r.type
ORDER BY tag_count DESC
LIMIT 20;

-- 19) Application Ownership Report
-- ===============================
SELECT 
    a.owner_email,
    COUNT(DISTINCT a.id) as applications_owned,
    COUNT(ram.resource_id) as total_resources
FROM application a
LEFT JOIN resource_application_map ram ON a.id = ram.application_id
WHERE a.owner_email IS NOT NULL
GROUP BY a.owner_email
ORDER BY total_resources DESC;

-- 20) Clean Up Queries
-- ===================
-- Remove resources without any tags (if needed)
-- DELETE FROM resource WHERE id NOT IN (SELECT DISTINCT resource_id FROM resource_tag);

-- Remove orphaned tags (if needed)
-- DELETE FROM resource_tag WHERE resource_id NOT IN (SELECT id FROM resource);

-- Remove applications without resources (if needed)
-- DELETE FROM application WHERE id NOT IN (SELECT DISTINCT application_id FROM resource_application_map WHERE application_id IS NOT NULL);
