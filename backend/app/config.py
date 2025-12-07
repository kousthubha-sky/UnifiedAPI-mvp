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
    environment: Literal["development", "production", "test"] = Field(
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

    # Payment Provider Configuration
    stripe_api_key: str | None = Field(
        default=None,
        alias="STRIPE_API_KEY",
        description="Stripe API key",
    )
    stripe_webhook_secret: str | None = Field(
        default=None,
        alias="STRIPE_WEBHOOK_SECRET",
        description="Stripe webhook secret",
    )
    paypal_mode: Literal["sandbox", "live"] = Field(
        default="sandbox",
        alias="PAYPAL_MODE",
        description="PayPal mode",
    )
    paypal_client_id: str | None = Field(
        default=None,
        alias="PAYPAL_CLIENT_ID",
        description="PayPal client ID",
    )
    paypal_client_secret: str | None = Field(
        default=None,
        alias="PAYPAL_CLIENT_SECRET",
        description="PayPal client secret",
    )
    paypal_webhook_id: str | None = Field(
        default=None,
        alias="PAYPAL_WEBHOOK_ID",
        description="PayPal webhook ID",
    )
    paypal_currency: str = Field(
        default="USD",
        alias="PAYPAL_CURRENCY",
        description="Default PayPal currency",
    )

    # Database Configuration
    database_pool_size: int = Field(
        default=20,
        alias="DATABASE_POOL_SIZE",
        description="Database connection pool size",
    )

    # Authentication
    allowed_api_keys: list[str] = Field(
        default_factory=list,
        alias="ALLOWED_API_KEYS",
        description="Comma-separated list of allowed API keys",
    )
    bootstrap_api_key: str | None = Field(
        default=None,
        alias="BOOTSTRAP_API_KEY",
        description="Bootstrap API key for signup flow",
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

    @field_validator("allowed_api_keys", mode="before")
    @classmethod
    def parse_allowed_api_keys(cls, v: str | list[str] | None) -> list[str]:
        """Parse comma-separated API keys into a list."""
        if v is None:
            return []
        if isinstance(v, list):
            return v
        return [k.strip() for k in v.split(",") if k.strip()]

    @property
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.environment == "production"

    @property
    def is_development(self) -> bool:
        """Check if running in development environment."""
        return self.environment == "development"

    @property
    def is_test(self) -> bool:
        """Check if running in test environment."""
        return self.environment == "test"

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
