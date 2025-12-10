"""
Admin API endpoints for managing payment provider credentials.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.auth import require_admin_role
from app.config import Settings, get_settings
from app.dependencies import SupabaseDep, get_supabase
from app.app_logging import get_logger
from app.payments.credential_service import PaymentCredentialService

logger = get_logger("admin.credentials")

router = APIRouter(
    prefix="/api/v1/admin/credentials",
    tags=["admin-credentials"],
    dependencies=[Depends(require_admin_role)]
)


class CredentialCreateRequest(BaseModel):
    """Request model for creating a credential."""

    environment: str = Field(..., description="Environment (local/staging/production)")
    provider: str = Field(..., description="Payment provider (stripe/paypal)")
    credential_type: str = Field(..., description="Credential type (api_key, client_secret, etc.)")
    credential_value: str = Field(..., description="The credential value")
    description: str | None = Field(None, description="Optional description")


class CredentialUpdateRequest(BaseModel):
    """Request model for updating a credential."""

    credential_value: str = Field(..., description="New credential value")
    description: str | None = Field(None, description="Optional updated description")


class CredentialResponse(BaseModel):
    """Response model for a credential."""

    id: str
    environment: str
    provider: str
    credential_type: str
    credential_key: str
    is_active: bool
    description: str | None
    created_at: str
    updated_at: str


class CredentialListResponse(BaseModel):
    """Response model for listing credentials."""

    credentials: list[CredentialResponse]


class ValidationResponse(BaseModel):
    """Response model for credential validation."""

    valid: bool
    missing_credentials: list[str]
    configured_credentials: list[str]


def get_credential_service(
    settings: Annotated[Settings, Depends(get_settings)],
    supabase: SupabaseDep,
) -> PaymentCredentialService:
    """Dependency to get the credential service."""
    return PaymentCredentialService(settings, supabase)


CredentialServiceDep = Annotated[PaymentCredentialService, Depends(get_credential_service)]


@router.post("/", response_model=CredentialResponse)
async def create_credential(
    request: CredentialCreateRequest,
    credential_service: CredentialServiceDep,
) -> CredentialResponse:
    """Create a new payment provider credential."""
    try:
        result = await credential_service.store_credential(
            environment=request.environment,
            provider=request.provider,
            credential_type=request.credential_type,
            credential_value=request.credential_value,
            description=request.description,
        )

        return CredentialResponse(**result)
    except Exception as e:
        logger.error("Failed to create credential", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create credential"
        )


@router.get("/", response_model=CredentialListResponse)
async def list_credentials(
    credential_service: CredentialServiceDep,
    environment: str | None = None,
    provider: str | None = None,
) -> CredentialListResponse:
    """List payment provider credentials."""
    try:
        credentials = await credential_service.list_credentials(environment, provider)
        return CredentialListResponse(credentials=credentials)
    except Exception as e:
        logger.error("Failed to list credentials", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list credentials"
        )


@router.put("/{environment}/{provider}/{credential_type}", response_model=CredentialResponse)
async def update_credential(
    environment: str,
    provider: str,
    credential_type: str,
    request: CredentialUpdateRequest,
    credential_service: CredentialServiceDep,
) -> CredentialResponse:
    """Update an existing credential."""
    try:
        result = await credential_service.update_credential(
            environment=environment,
            provider=provider,
            credential_type=credential_type,
            new_value=request.credential_value,
            description=request.description,
        )

        return CredentialResponse(**result)
    except Exception as e:
        logger.error("Failed to update credential", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update credential"
        )


@router.delete("/{environment}/{provider}/{credential_type}")
async def deactivate_credential(
    environment: str,
    provider: str,
    credential_type: str,
    credential_service: CredentialServiceDep,
) -> dict[str, str]:
    """Deactivate a credential."""
    try:
        success = await credential_service.deactivate_credential(
            environment, provider, credential_type
        )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Credential not found"
            )

        return {"message": "Credential deactivated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to deactivate credential", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to deactivate credential"
        )


@router.get("/validate/{environment}/{provider}", response_model=ValidationResponse)
async def validate_provider_credentials(
    environment: str,
    provider: str,
    credential_service: CredentialServiceDep,
) -> ValidationResponse:
    """Validate that all required credentials are configured for a provider."""
    try:
        result = await credential_service.validate_provider_setup(environment, provider)
        return ValidationResponse(**result)
    except Exception as e:
        logger.error("Failed to validate credentials", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to validate credentials"
        )