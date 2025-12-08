-- Migration to add performance indexes for common query patterns
-- These indexes improve query performance for payment and audit log lookups

-- Payments table indexes
CREATE INDEX IF NOT EXISTS idx_payments_customer_status ON payments(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_created_status ON payments(created_at DESC, status);

-- Audit logs table indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_customer_created ON audit_logs(customer_id, created_at DESC);