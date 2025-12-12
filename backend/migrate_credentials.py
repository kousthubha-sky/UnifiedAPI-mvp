"""
Migration script to move payment provider credentials from environment variables to database.
Run this script after deploying the new database schema.
"""

import asyncio
import os
import sys
from pathlib import Path

# Add the backend directory to the path so we can import modules
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from app.config import Settings
from app.payments.credential_service import PaymentCredentialService
from supabase import create_client


async def migrate_credentials():
    """Migrate existing payment credentials from env vars to database."""

    # Get settings
    settings = Settings()

    # Initialize Supabase client
    supabase = create_client(
        supabase_url=settings.supabase_url,
        supabase_key=settings.supabase_service_key
    )

    # Initialize credential service
    credential_service = PaymentCredentialService(settings, supabase)

    # Determine environment
    environment_map = {
        "development": "local",
        "production": "production",
        "test": "local"
    }
    environment = environment_map.get(settings.environment, "local")

    print(f"Migrating credentials for environment: {environment}")

    migrated = []
    skipped = []

    # Migrate PayPal credentials
    if settings.paypal_client_id:
        try:
            await credential_service.store_credential(
                environment=environment,
                provider="paypal",
                credential_type="client_id",
                credential_value=settings.paypal_client_id,
                description="Migrated from PAYPAL_CLIENT_ID environment variable"
            )
            migrated.append("PayPal Client ID")
            print("✓ Migrated PayPal Client ID")
        except Exception as e:
            print(f"✗ Failed to migrate PayPal Client ID: {e}")
            skipped.append("PayPal Client ID")

    if settings.paypal_client_secret:
        try:
            await credential_service.store_credential(
                environment=environment,
                provider="paypal",
                credential_type="client_secret",
                credential_value=settings.paypal_client_secret,
                description="Migrated from PAYPAL_CLIENT_SECRET environment variable"
            )
            migrated.append("PayPal Client Secret")
            print("✓ Migrated PayPal Client Secret")
        except Exception as e:
            print(f"✗ Failed to migrate PayPal Client Secret: {e}")
            skipped.append("PayPal Client Secret")

    if settings.paypal_webhook_id:
        try:
            await credential_service.store_credential(
                environment=environment,
                provider="paypal",
                credential_type="webhook_id",
                credential_value=settings.paypal_webhook_id,
                description="Migrated from PAYPAL_WEBHOOK_ID environment variable"
            )
            migrated.append("PayPal Webhook ID")
            print("✓ Migrated PayPal Webhook ID")
        except Exception as e:
            print(f"✗ Failed to migrate PayPal Webhook ID: {e}")
            skipped.append("PayPal Webhook ID")

    # Summary
    print(f"\nMigration Summary:")
    print(f"✅ Successfully migrated: {len(migrated)} credentials")
    for item in migrated:
        print(f"   - {item}")

    if skipped:
        print(f"❌ Failed to migrate: {len(skipped)} credentials")
        for item in skipped:
            print(f"   - {item}")

    print(f"\n📝 Next steps:")
    print(f"1. Verify credentials are working in the database")
    print(f"2. Remove payment credential environment variables from deployment")
    print(f"3. Update payment adapters to use database credentials only")
    print(f"4. Test payment processing with migrated credentials")


if __name__ == "__main__":
    print("Starting payment credential migration...")
    asyncio.run(migrate_credentials())
    print("Migration completed!")