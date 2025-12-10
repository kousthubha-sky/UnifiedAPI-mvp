"""Configuration management using pydantic-settings.

Loads settings from environment variables, maintaining backward compatibility
with the Node.js/Fastify backend's environment variable names.
"""

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Server Configuration
    environment: Literal["development", "staging", "production", "test"] = Field(
        default="development",
        alias="NODE_ENV",
        description="Runtime environment",
    )
    log_level: Literal["debug", "info", "warning", "error", "critical"] = Field(
        default="info",
        alias="LOG_LEVEL",
        description="Logging level",
    )
    port: int = Field(
        default=3001,
        alias="PORT",
        description="Server port",
    )
    host: str = Field(
        default="0.0.0.0",
        alias="HOST",
        description="Server host",
    )

    # Supabase Configuration
    supabase_url: str | None = Field(
        default=None,
        alias="SUPABASE_URL",
        description="Supabase project URL",
    )
    supabase_anon_key: str | None = Field(
        default=None,
        alias="SUPABASE_ANON_KEY",
        description="Supabase anonymous key",
    )
    supabase_service_key: str | None = Field(
        default=None,
        alias="SUPABASE_SERVICE_KEY",
        description="Supabase service role key",
    )

    # Redis Configuration
    redis_url: str = Field(
        default="redis://localhost:6379",
        alias="REDIS_URL",
        description="Redis connection URL",
    )
    redis_max_retries: int = Field(
        default=3,
        alias="REDIS_MAX_RETRIES",
        description="Maximum Redis connection retries",
    )

    # Payment Provider Configuration (now stored in database)
    # These environment variables are deprecated and will be removed
    # Credentials are now managed through the admin UI and stored encrypted in the database
    stripe_api_key: str | None = Field(
        default=None,
        alias="STRIPE_API_KEY",
        description="[DEPRECATED] Stripe API key - migrate to database storage",
    )
    stripe_webhook_secret: str | None = Field(
        default=None,
        alias="STRIPE_WEBHOOK_SECRET",
        description="[DEPRECATED] Stripe webhook secret - migrate to database storage",
    )
    paypal_mode: Literal["sandbox", "live"] = Field(
        default="sandbox",
        alias="PAYPAL_MODE",
        description="PayPal mode (still used for sandbox/live detection)",
    )
    paypal_client_id: str | None = Field(
        default=None,
        alias="PAYPAL_CLIENT_ID",
        description="[DEPRECATED] PayPal client ID - migrate to database storage",
    )
    paypal_client_secret: str | None = Field(
        default=None,
        alias="PAYPAL_CLIENT_SECRET",
        description="[DEPRECATED] PayPal client secret - migrate to database storage",
    )
    paypal_webhook_id: str | None = Field(
        default=None,
        alias="PAYPAL_WEBHOOK_ID",
        description="[DEPRECATED] PayPal webhook ID - migrate to database storage",
    )
    paypal_currency: str = Field(
        default="USD",
        alias="PAYPAL_CURRENCY",
        description="Default PayPal currency",
    )

    @field_validator('credential_encryption_key')
    @classmethod
    def validate_encryption_key(cls, v: str, info) -> str:
        """Ensure production environments don't use the default encryption key."""
        # Get environment from the validation context
        if hasattr(info, 'data') and info.data.get('environment') == 'production':
            if v == 'default-dev-encryption-key-change-in-production':
                raise ValueError(
                    'Production environment must not use the default encryption key. '
                    'Set CREDENTIAL_ENCRYPTION_KEY environment variable.'
                )
        return v

    # Credential encryption key
    credential_encryption_key: str = Field(
        default="default-dev-encryption-key-change-in-production",
        alias="CREDENTIAL_ENCRYPTION_KEY",
        description="Key for encrypting payment provider credentials in database",
    )
    # Database Configuration
    database_pool_size: int = Field(
        default=20,
        alias="DATABASE_POOL_SIZE",
        description="Database connection pool size",
    )

    # Authentication
    allowed_api_keys_raw: str = Field(
        default_factory=list,
        alias="ALLOWED_API_KEYS",
        description="Comma-separated list of allowed API keys",
    )
    bootstrap_api_key: str | None = Field(
        default=None,
        alias="BOOTSTRAP_API_KEY",
        description="Bootstrap API key for signup flow",
    )
    clerk_secret_key: str | None = Field(
        default=None,
        alias="CLERK_SECRET_KEY",
        description="Clerk secret key for JWT verification",
    )

    # Test Bypass Configuration
    test_bypass_token: str | None = Field(
        default=None,
        alias="TEST_BYPASS_TOKEN",
        description="Secret token for test bypass in non-production environments",
    )

    # CORS & API Configuration
    cors_origin: str = Field(
        default="*",
        alias="CORS_ORIGIN",
        description="CORS allowed origins",
    )
    cors_allowed_methods: str = Field(
        default="GET,POST,PATCH,DELETE",
        alias="CORS_ALLOWED_METHODS",
        description="CORS allowed methods",
    )
    api_host: str = Field(
        default="localhost:3001",
        alias="API_HOST",
        description="API host for documentation",
    )
    api_scheme: Literal["http", "https"] = Field(
        default="http",
        alias="API_SCHEME",
        description="API scheme for documentation",
    )

    @staticmethod
    def parse_allowed_api_keys(v: str | list[str] | None) -> list[str]:
        """Parse comma-separated API keys into a list."""
        if v is None:
            return []
        if isinstance(v, list):
            return v
        return [k.strip() for k in v.split(",") if k.strip()]

    @property
    def allowed_api_keys(self) -> list[str]:
        """Parse comma-separated API keys into a list."""
        return self.parse_allowed_api_keys(self.allowed_api_keys_raw)

    @property
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.environment == "production"

    @property
    def is_staging(self) -> bool:
        """Check if running in staging environment."""
        return self.environment == "staging"

    @property
    def is_development(self) -> bool:
        """Check if running in development environment."""
        return self.environment == "development"

    @property
    def is_test(self) -> bool:
        """Check if running in test environment."""
        return self.environment == "test"

    @property
    def is_non_production(self) -> bool:
        """Check if running in a non-production environment."""
        return self.environment != "production"

    @property
    def cors_methods_list(self) -> list[str]:
        """Get CORS methods as a list."""
        return [m.strip() for m in self.cors_allowed_methods.split(",")]


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance.

    Uses lru_cache to ensure settings are only loaded once
    and reused throughout the application.
    """
    return Settings()
