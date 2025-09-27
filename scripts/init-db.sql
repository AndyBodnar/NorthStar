-- Initialize North Star database
-- This script creates the basic database structure

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create schemas for each service
CREATE SCHEMA IF NOT EXISTS identity;
CREATE SCHEMA IF NOT EXISTS memory;
CREATE SCHEMA IF NOT EXISTS sensing;
CREATE SCHEMA IF NOT EXISTS generation;
CREATE SCHEMA IF NOT EXISTS interaction;
CREATE SCHEMA IF NOT EXISTS autonomy;
CREATE SCHEMA IF NOT EXISTS truth;
CREATE SCHEMA IF NOT EXISTS economy;
CREATE SCHEMA IF NOT EXISTS governance;

-- Set default permissions
GRANT USAGE ON SCHEMA identity TO postgres;
GRANT USAGE ON SCHEMA memory TO postgres;
GRANT USAGE ON SCHEMA sensing TO postgres;
GRANT USAGE ON SCHEMA generation TO postgres;
GRANT USAGE ON SCHEMA interaction TO postgres;
GRANT USAGE ON SCHEMA autonomy TO postgres;
GRANT USAGE ON SCHEMA truth TO postgres;
GRANT USAGE ON SCHEMA economy TO postgres;
GRANT USAGE ON SCHEMA governance TO postgres;

-- Create common functions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Log initialization
INSERT INTO pg_stat_statements_info (dealloc) VALUES (0) ON CONFLICT DO NOTHING;

COMMENT ON DATABASE north_star IS 'North Star API Constellation Database';