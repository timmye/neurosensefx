-- =============================================================================
-- NEUROSENSE FX - POSTGRESQL INITIALIZATION SCRIPT
-- =============================================================================

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create application user
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_database WHERE datname = 'neurosensefx_dev') THEN
        CREATE DATABASE neurosensefx_dev;
    END IF;
END
$$;

-- Connect to the application database
\c neurosensefx_dev

-- Create tables (example schema - adjust as needed)
CREATE TABLE IF NOT EXISTS app_config (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_app_config_key ON app_config(key);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO neurosensefx;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO neurosensefx;

-- Insert default configuration
INSERT INTO app_config (key, value) VALUES
    ('app_version', '"1.0.0"'),
    ('maintenance_mode', 'false')
ON CONFLICT (key) DO NOTHING;
