-- Add SDK-compatible fields to payments table
-- Migration: 006_add_sdk_payment_fields.sql

-- Add new columns for SDK compatibility
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255);

-- Create indexes for the new fields
CREATE INDEX IF NOT EXISTS idx_payments_customer_email ON payments(customer_email);
CREATE INDEX IF NOT EXISTS idx_payments_description ON payments(description);

-- Update existing records to populate customer_email and customer_name from customer table
-- This is a one-time data migration
UPDATE payments
SET
  customer_email = customers.email,
  customer_name = COALESCE(customers.email, 'Unknown')  -- Use email as fallback for name
FROM customers
WHERE payments.customer_id = customers.id
  AND (payments.customer_email IS NULL OR payments.customer_name IS NULL);

-- Add comments for documentation
COMMENT ON COLUMN payments.description IS 'Optional payment description from SDK request';
COMMENT ON COLUMN payments.customer_email IS 'Customer email from SDK request (may differ from customer record)';
COMMENT ON COLUMN payments.customer_name IS 'Customer name from SDK request';