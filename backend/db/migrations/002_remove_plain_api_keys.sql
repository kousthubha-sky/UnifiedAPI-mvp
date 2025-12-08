-- Migration to remove plain text API keys for security
-- This migration removes the 'key' column from api_keys table
-- Only hashed keys are stored for security

-- First, drop the index on the key column
DROP INDEX IF EXISTS idx_api_keys_key;

-- Remove the plain text key column
ALTER TABLE api_keys DROP COLUMN IF EXISTS key;