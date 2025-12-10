"""
Payment credential service for managing payment provider credentials in the database.
"""

from __future__ import annotations

from typing import Any

from supabase import Client as SupabaseClient

from app.config import Settings
from app.payments.encryption import CredentialEncryption


class PaymentCredentialService:
    """Service for managing payment provider credentials."""

    def __init__(self, settings: Settings, supabase: SupabaseClient):
        """Initialize the credential service.

        Args:
            settings: Application settings
            supabase: Supabase client
        """
        self.settings = settings
        self.supabase = supabase
        self.encryption = CredentialEncryption(settings, supabase)

    async def get_credential_value(
        self,
        environment: str,
        provider: str,
        credential_type: str
    ) -> str | None:
        """Get a decrypted credential value.

        Args:
            environment: Environment (local/staging/production)
            provider: Payment provider (stripe/paypal)
            credential_type: Type of credential (api_key, client_secret, etc.)

        Returns:
            Decrypted credential value or None if not found
        """
        return await self.encryption.get_credential(environment, provider, credential_type)

    async def store_credential(
        self,
        environment: str,
        provider: str,
        credential_type: str,
        credential_value: str,
        description: str | None = None
    ) -> dict[str, Any]:
        """Store a new credential.

        Args:
            environment: Environment (local/staging/production)
            provider: Payment provider (stripe/paypal)
            credential_type: Type of credential (api_key, client_secret, etc.)
            credential_value: Plain text credential value
            description: Optional description

        Returns:
            Created credential record
        """
        return await self.encryption.store_credential(
            environment, provider, credential_type, credential_value, description
        )

    async def update_credential(
        self,
        environment: str,
        provider: str,
        credential_type: str,
        new_value: str,
        description: str | None = None
    ) -> dict[str, Any]:
        """Update an existing credential.

        Args:
            environment: Environment (local/staging/production)
            provider: Payment provider (stripe/paypal)
            credential_type: Type of credential (api_key, client_secret, etc.)
            new_value: New plain text credential value
            description: Optional updated description

        Returns:
            Updated credential record
        """
        return await self.encryption.update_credential(
            environment, provider, credential_type, new_value, description
        )

    async def deactivate_credential(
        self,
        environment: str,
        provider: str,
        credential_type: str
    ) -> bool:
        """Deactivate a credential.

        Args:
            environment: Environment (local/staging/production)
            provider: Payment provider (stripe/paypal)
            credential_type: Type of credential (api_key, client_secret, etc.)

        Returns:
            True if credential was deactivated
        """
        return await self.encryption.deactivate_credential(environment, provider, credential_type)

    async def list_credentials(
        self,
        environment: str | None = None,
        provider: str | None = None
    ) -> list[dict[str, Any]]:
        """List credentials (without decrypted values).

        Args:
            environment: Optional environment filter
            provider: Optional provider filter

        Returns:
            List of credential records (values not included)
        """
        return await self.encryption.list_credentials(environment, provider)

    async def get_provider_credentials(self, environment: str, provider: str) -> dict[str, str]:
        """Get all credentials for a specific provider in an environment.

        Args:
            environment: Environment (local/staging/production)
            provider: Payment provider (stripe/paypal)

        Returns:
            Dictionary of credential_type -> decrypted_value
        """
        credentials = {}

        # Define the credential types we need for each provider
        if provider == 'stripe':
            credential_types = ['api_key', 'webhook_secret']
        elif provider == 'paypal':
            credential_types = ['client_id', 'client_secret', 'webhook_id']
        else:
            credential_types = []

        for credential_type in credential_types:
            value = await self.get_credential_value(environment, provider, credential_type)
            if value:
                credentials[credential_type] = value

        return credentials

    async def validate_provider_setup(self, environment: str, provider: str) -> dict[str, Any]:
        """Validate that all required credentials are configured for a provider.

        Args:
            environment: Environment (local/staging/production)
            provider: Payment provider (stripe/paypal)

        Returns:
            Validation result with status and missing credentials
        """
        required_credentials = {
            'stripe': ['api_key'],
            'paypal': ['client_id', 'client_secret']
        }

        if provider not in required_credentials:
            return {
                'valid': False,
                'error': f'Unknown provider: {provider}'
            }

        credentials = await self.get_provider_credentials(environment, provider)
        missing = []

        for required_type in required_credentials[provider]:
            if required_type not in credentials:
                missing.append(required_type)

        return {
            'valid': len(missing) == 0,
            'missing_credentials': missing,
            'configured_credentials': list(credentials.keys())
        }