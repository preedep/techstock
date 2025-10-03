-- 1) มิติระบบ Azure
CREATE TABLE subscription (
                              id           BIGSERIAL PRIMARY KEY,
                              name         TEXT NOT NULL,
                              tenant_id    TEXT
);

CREATE TABLE resource_group (
                                id              BIGSERIAL PRIMARY KEY,
                                name            TEXT NOT NULL,
                                subscription_id BIGINT NOT NULL REFERENCES subscription(id)
);

-- 2) แอปพลิเคชัน/บริการ (มาจาก Tags เช่น AppID/AppName)
CREATE TABLE application (
                             id        BIGSERIAL PRIMARY KEY,
                             code      TEXT UNIQUE,     -- AppID เช่น 'AP2411'
                             name      TEXT,            -- AppName เช่น 'UDP'
                             owner_team TEXT,
                             owner_email TEXT
);

-- 3) Resource หลัก
CREATE TABLE resource (
                          id                BIGSERIAL PRIMARY KEY,
                          azure_id          TEXT UNIQUE,      -- ARM ID (resourceId) ถ้ามี
                          name              TEXT NOT NULL,    -- เช่น '001e8270207...'
                          type              TEXT NOT NULL,    -- เช่น 'Virtual machine', 'Disk'
                          kind              TEXT,
                          location          TEXT,
                          subscription_id   BIGINT REFERENCES subscription(id),
                          resource_group_id BIGINT REFERENCES resource_group(id),
                          tags_json         JSONB,            -- เก็บทั้งก้อนสำหรับ UI/ค้นเร็ว
                          extended_location TEXT,
                          vendor            TEXT,             -- สกัดจาก tags: 'Vendor'
                          environment       TEXT,             -- 'PRD','UAT',…
                          provisioner       TEXT,             -- 'Terraform',…
                          created_at        TIMESTAMPTZ DEFAULT NOW(),
                          updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 4) Tag แบบ EAV (เหมาะกับ query ‘ค้นตาม TAG’ แบบ join)
CREATE TABLE resource_tag (
                              resource_id BIGINT REFERENCES resource(id) ON DELETE CASCADE,
                              key         TEXT NOT NULL,
                              value       TEXT,
                              PRIMARY KEY (resource_id, key)
);

-- 5) Mapping Resource↔Application
CREATE TABLE resource_application_map (
                                          resource_id    BIGINT REFERENCES resource(id) ON DELETE CASCADE,
                                          application_id BIGINT REFERENCES application(id) ON DELETE CASCADE,
                                          relation_type  TEXT DEFAULT 'uses',  -- 'uses'/'owns'/'managed-by' (ตามนโยบายคุณ)
                                          PRIMARY KEY (resource_id, application_id, relation_type)
);

-- 6) Indexes ที่ควรมี
CREATE INDEX idx_resource_type          ON resource(type);
CREATE INDEX idx_resource_location      ON resource(location);
CREATE INDEX idx_resource_vendor        ON resource(vendor);
CREATE INDEX idx_resource_environment   ON resource(environment);
CREATE INDEX idx_resource_tags_gin      ON resource USING GIN (tags_json jsonb_path_ops);
CREATE INDEX idx_resource_tag_key       ON resource_tag(key);
CREATE INDEX idx_resource_tag_key_val   ON resource_tag(key, value);