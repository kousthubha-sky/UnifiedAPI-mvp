# Database Setup

This directory contains the database schema and migration scripts for the PaymentHub API.

## Supabase Setup

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in or create an account
2. Create a new project
3. Choose a region close to your users
4. Set a strong database password
5. Wait for the project to initialize (usually 1-2 minutes)

### 2. Run Migrations

Once your Supabase project is ready:

1. Go to the SQL Editor in the Supabase Dashboard
2. Open the `migrations/001_initial_schema.sql` file
3. Copy the entire SQL content
4. Paste it into the SQL Editor in your Supabase project
5. Click "Run" to execute the migration

Alternatively, if you have the Supabase CLI installed:

```bash
# Create a migration file
supabase migration new initial_schema

# Push the migration to your project
supabase db push
```

### 3. Verify Tables

After running the migration, you should see the following tables in your Supabase project:

- `customers` - Stores customer information and account details
- `api_keys` - Stores API keys for authentication
- `audit_logs` - Stores audit logs for all API requests
- `usage_stats` - Stores usage statistics by customer and date
- `payments` - Stores payment transaction records

## Database Schema

### customers
```sql
id - UUID (Primary Key)
email - VARCHAR(255) - Unique email address
api_key - VARCHAR(255) - Unique API key (optional)
tier - VARCHAR(50) - Plan tier (starter, growth, scale)
stripe_account_id - VARCHAR(255) - Stripe account ID
paypal_account_id - VARCHAR(255) - PayPal account ID
created_at - TIMESTAMP
updated_at - TIMESTAMP
```

### api_keys
```sql
id - UUID (Primary Key)
customer_id - UUID (Foreign Key to customers)
key_hash - VARCHAR(255) - SHA256 hash of the API key
key - VARCHAR(255) - The actual API key (sk_* format)
name - VARCHAR(255) - Optional name for the key
is_active - BOOLEAN - Whether the key is active
last_used_at - TIMESTAMP - When the key was last used
created_at - TIMESTAMP
updated_at - TIMESTAMP
```

### audit_logs
```sql
id - UUID (Primary Key)
trace_id - VARCHAR(255) - Trace ID for request tracking
customer_id - UUID (Foreign Key to customers)
endpoint - VARCHAR(255) - API endpoint called
method - VARCHAR(10) - HTTP method (GET, POST, etc.)
provider - VARCHAR(50) - Payment provider (stripe, paypal)
status - INTEGER - HTTP status code
latency_ms - INTEGER - Request latency in milliseconds
error_message - TEXT - Error message if any
request_body - JSONB - Request payload
response_body - JSONB - Response payload
created_at - TIMESTAMP
```

### usage_stats
```sql
id - UUID (Primary Key)
customer_id - UUID (Foreign Key to customers)
date - DATE - Date of the statistics
request_count - INTEGER - Number of requests made
created_at - TIMESTAMP
updated_at - TIMESTAMP
```

### payments
```sql
id - UUID (Primary Key)
customer_id - UUID (Foreign Key to customers)
provider_transaction_id - VARCHAR(255) - Provider's transaction ID
provider - VARCHAR(50) - Payment provider (stripe, paypal)
amount - NUMERIC(19, 4) - Payment amount
currency - VARCHAR(3) - Currency code
status - VARCHAR(50) - Payment status
metadata - JSONB - Additional metadata
refund_id - VARCHAR(255) - Refund transaction ID
refund_status - VARCHAR(50) - Refund status
refund_amount - NUMERIC(19, 4) - Refund amount
created_at - TIMESTAMP
updated_at - TIMESTAMP
```

## Indexes

The migration automatically creates indexes for optimal query performance:

- `idx_customers_email` - For quick customer lookup by email
- `idx_customers_api_key` - For API key authentication
- `idx_api_keys_customer_id` - For listing keys by customer
- `idx_api_keys_key` - For API key validation
- `idx_api_keys_is_active` - For active key filtering
- `idx_audit_logs_customer_id` - For audit log filtering
- `idx_audit_logs_trace_id` - For trace ID tracking
- `idx_audit_logs_created_at` - For time-based queries
- `idx_audit_logs_endpoint` - For endpoint-based queries
- `idx_usage_stats_customer_id` - For usage tracking
- `idx_usage_stats_date` - For date-based queries
- `idx_payments_customer_id` - For payment lookup
- `idx_payments_provider_transaction_id` - For provider reference
- `idx_payments_status` - For status filtering

## Access Control

### Public (Anon) Access
The anonymous key can be used for:
- Creating new customers (POST /api/v1/customers)

### Authenticated Access
API keys with valid customer association can:
- Manage their own API keys
- Access their customer profile
- Make payments
- View their audit logs

### Admin Access
Hardcoded admin API keys (from ALLOWED_API_KEYS) have:
- Full access to all endpoints
- No rate limiting

## Best Practices

1. **Never expose the service key** - Only use the anon key in client-side code
2. **Rotate API keys regularly** - Use the rotate endpoint to generate new keys
3. **Monitor audit logs** - Review audit_logs table for suspicious activity
4. **Track usage** - Check usage_stats to monitor customer activity
5. **Backup regularly** - Use Supabase's automated backups feature

## Troubleshooting

### Connection Issues
- Verify SUPABASE_URL and SUPABASE_ANON_KEY are correct
- Check that your Supabase project is active
- Ensure your IP is not blocked by Supabase firewall

### Migration Failures
- Check for SQL syntax errors in the migration file
- Ensure all tables don't already exist (script uses IF NOT EXISTS)
- Check Supabase logs for specific error messages

### Performance Issues
- Verify all indexes are created (check in Supabase dashboard)
- Consider partitioning large tables like audit_logs
- Monitor database connection limits

## Next Steps

1. Update your `.env` file with your Supabase credentials
2. Run the backend server to initialize the repositories
3. Create your first customer via the API
4. Generate API keys for your customer
5. Start making payments!
