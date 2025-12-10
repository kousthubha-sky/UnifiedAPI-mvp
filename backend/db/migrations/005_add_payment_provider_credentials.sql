-- Create payment_provider_credentials table for secure credential storage
CREATE TABLE IF NOT EXISTS payment_provider_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment VARCHAR(50) NOT NULL CHECK (environment IN ('local', 'staging', 'production')),
  provider VARCHAR(50) NOT NULL CHECK (provider IN ('stripe', 'paypal')),
  credential_type VARCHAR(100) NOT NULL, -- 'api_key', 'client_secret', 'webhook_secret', 'client_id', etc.
  credential_key VARCHAR(255) NOT NULL, -- Encrypted credential identifier
  credential_value TEXT NOT NULL, -- Encrypted credential value
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Ensure unique combination of environment + provider + credential_type
  UNIQUE(environment, provider, credential_type)
);

-- Create indexes for payment_provider_credentials table
CREATE INDEX IF NOT EXISTS idx_payment_credentials_environment ON payment_provider_credentials(environment);
CREATE INDEX IF NOT EXISTS idx_payment_credentials_provider ON payment_provider_credentials(provider);
CREATE INDEX IF NOT EXISTS idx_payment_credentials_active ON payment_provider_credentials(is_active);
CREATE INDEX IF NOT EXISTS idx_payment_credentials_type ON payment_provider_credentials(credential_type);

-- Add RLS (Row Level Security) policies
ALTER TABLE payment_provider_credentials ENABLE ROW LEVEL SECURITY;

-- Only allow access to active credentials
CREATE POLICY "payment_credentials_active_only" ON payment_provider_credentials
  FOR ALL USING (is_active = true);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_payment_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_payment_credentials_updated_at
  BEFORE UPDATE ON payment_provider_credentials
  FOR EACH ROW EXECUTE FUNCTION update_payment_credentials_updated_at();

-- Create encryption/decryption functions using Supabase's built-in PGP functions
-- Note: These functions use the pgcrypto extension which is available in Supabase

CREATE OR REPLACE FUNCTION encrypt_credential(plain_value TEXT, encryption_key TEXT)
RETURNS TABLE(encrypted_value TEXT) AS $$
BEGIN
  RETURN QUERY SELECT encode(
    pgp_sym_encrypt(plain_value, encryption_key, 'cipher-algo=aes256'),
    'base64'
  ) as encrypted_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrypt_credential(encrypted_value TEXT, encryption_key TEXT)
RETURNS TABLE(decrypted_value TEXT) AS $$
BEGIN
  RETURN QUERY SELECT pgp_sym_decrypt(
    decode(encrypted_value, 'base64'),
    encryption_key,
    'cipher-algo=aes256'
  ) as decrypted_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;