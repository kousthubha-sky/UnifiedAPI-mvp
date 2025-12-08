-- Add user_id column to customers table for Clerk integration
ALTER TABLE customers ADD COLUMN user_id TEXT UNIQUE;