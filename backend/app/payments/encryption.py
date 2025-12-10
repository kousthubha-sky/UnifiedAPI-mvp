"""
Encryption utilities for secure credential storage using Supabase's built-in PGP functions.

Uses AES-256 encryption with a master key for credential values.
"""

from __future__ import annotations

import os
from typing import Any

from supabase import Client as SupabaseClient

from app.config import Settings


class CredentialEncryption:
    """Handles encryption/decryption of payment provider credentials."""

    def __init__(self, settings: Settings, supabase: SupabaseClient | None = None):
        """Initialize encryption utilities.

        Args:
            settings: Application settings
            supabase: Supabase client for database operations
        """
        self.settings = settings
        self.supabase = supabase

        # Use a consistent encryption key - in production this should be from env vars
        # For now, we'll use a default key that can be overridden
        self.encryption_key = os.getenv('CREDENTIAL_ENCRYPTION_KEY')
        if not self.encryption_key:
            if os.getenv('NODE_ENV') == 'production' or os.getenv('UNIFIED_ENV') == 'production':
                raise ValueError("CREDENTIAL_ENCRYPTION_KEY must be set in production")
            self.encryption_key = 'default-dev-encryption-key-change-in-production'

    def encrypt_value(self, plain_value: str) -> str:
        """Encrypt a credential value.

        Args:
            plain_value: The plain text credential value

        Returns:
            Encrypted value as base64 string
        """
        if not self.supabase:
            raise ValueError("Supabase client required for encryption operations")

        # Use Supabase's built-in PGP symmetric encryption
        result = self.supabase.rpc(
            'encrypt_credential',
            {
                'plain_value': plain_value,
                'encryption_key': self.encryption_key
            }
        ).execute()

        if result.data and len(result.data) > 0:
            return str(result.data[0].get('encrypted_value', ''))
        raise ValueError("Failed to encrypt credential value")

    def decrypt_value(self, encrypted_value: str) -> str:
        """Decrypt a credential value.

        Args:
            encrypted_value: The encrypted credential value

        Returns:
            Decrypted plain text value
        """
        if not self.supabase:
            raise ValueError("Supabase client required for decryption operations")

        # Use Supabase's built-in PGP symmetric decryption
        result = self.supabase.rpc(
            'decrypt_credential',
            {
                'encrypted_value': encrypted_value,
                'encryption_key': self.encryption_key
            }
        ).execute()

        if result.data and len(result.data) > 0:
            return str(result.data[0].get('decrypted_value', ''))
        raise ValueError("Failed to decrypt credential value")

    async def store_credential(
        self,
        environment: str,
        provider: str,
        credential_type: str,
        credential_value: str,
        description: str | None = None
    ) -> dict[str, Any]:
        """Store an encrypted credential in the database.

        Args:
            environment: Environment (local/staging/production)
            provider: Payment provider (stripe/paypal)
            credential_type: Type of credential (api_key, client_secret, etc.)
            credential_value: Plain text credential value
            description: Optional description

        Returns:
            Created credential record
        """
        if not self.supabase:
            raise ValueError("Supabase client required for database operations")

        # Encrypt the value
        encrypted_value = self.encrypt_value(credential_value)

        # Generate a credential key (not the actual value)
        credential_key = f"{environment}_{provider}_{credential_type}"

        # Store in database
        result = self.supabase.table('payment_provider_credentials').insert({
            'environment': environment,
            'provider': provider,
            'credential_type': credential_type,
            'credential_key': credential_key,
            'credential_value': encrypted_value,
            'description': description,
            'is_active': True
        }).execute()

        if result.data and len(result.data) > 0:
            return dict(result.data[0])
        raise ValueError("Failed to store credential")

    async def get_credential(
        self,
        environment: str,
        provider: str,
        credential_type: str
    ) -> str | None:
        """Retrieve and decrypt a credential value.

        Args:
            environment: Environment (local/staging/production)
            provider: Payment provider (stripe/paypal)
            credential_type: Type of credential (api_key, client_secret, etc.)

        Returns:
            Decrypted credential value or None if not found
        """
        if not self.supabase:
            raise ValueError("Supabase client required for database operations")

        # Fetch from database
        result = self.supabase.table('payment_provider_credentials').select(
            'credential_value'
        ).eq('environment', environment).eq('provider', provider).eq(
            'credential_type', credential_type
        ).eq('is_active', True).execute()

        if not result.data or len(result.data) == 0:
            return None

        # Decrypt the value
        encrypted_value = str(result.data[0].get('credential_value', ''))
        return self.decrypt_value(encrypted_value)

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
        if not self.supabase:
            raise ValueError("Supabase client required for database operations")

        # Encrypt the new value
        encrypted_value = self.encrypt_value(new_value)

        # Update in database
        # Note: updated_at will be set automatically by database trigger
        update_data = {
            'credential_value': encrypted_value
        }
        if description is not None:
            update_data['description'] = description

        result = self.supabase.table('payment_provider_credentials').update(
            update_data
        ).eq('environment', environment).eq('provider', provider).eq(
            'credential_type', credential_type
        ).execute()

        if result.data and len(result.data) > 0:
            return dict(result.data[0])
        raise ValueError("Failed to update credential")

    async def deactivate_credential(
        self,
        environment: str,
        provider: str,
        credential_type: str
    ) -> bool:
        """Deactivate a credential (soft delete).

        Args:
            environment: Environment (local/staging/production)
            provider: Payment provider (stripe/paypal)
            credential_type: Type of credential (api_key, client_secret, etc.)

        Returns:
            True if credential was deactivated
        """
        if not self.supabase:
            raise ValueError("Supabase client required for database operations")

        # Note: updated_at will be set automatically by database trigger
        result = self.supabase.table('payment_provider_credentials').update({
            'is_active': False
        }).eq('environment', environment).eq('provider', provider).eq(
            'credential_type', credential_type
        ).execute()

        return len(result.data) > 0

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
        if not self.supabase:
            raise ValueError("Supabase client required for database operations")

        query = self.supabase.table('payment_provider_credentials').select(
            'id, environment, provider, credential_type, credential_key, '
            'is_active, description, created_at, updated_at'
        )

        if environment:
            query = query.eq('environment', environment)
        if provider:
            query = query.eq('provider', provider)

        result = query.order('environment').order('provider').order('credential_type').execute()

        return [dict(item) for item in result.data] if result.data else []