"""Payment API routes.

Provides the REST API endpoints for payment operations.
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, Query, Request

from app.config import Settings, get_settings
from app.dependencies import RedisDep, SupabaseDep, get_redis, get_supabase
from app.logging import get_logger
from app.payments.service import PaymentService
from app.payments.types import (
    CreatePaymentRequest,
    CreatePaymentResponse,
    ListPaymentsRequest,
    ListPaymentsResponse,
    PaymentProvider,
    PaymentStatus,
    PaymentStatusResponse,
    RefundPaymentRequest,
    RefundPaymentResponse,
)

logger = get_logger("payments.routes")

router = APIRouter(prefix="/api/v1/payments", tags=["payments"])


def get_payment_service(
    settings: Annotated[Settings, Depends(get_settings)],
    supabase: SupabaseDep,
    redis: RedisDep,
) -> PaymentService:
    """Dependency to get the payment service."""
    return PaymentService(
        settings=settings,
        supabase=supabase,
        redis=redis,
    )


PaymentServiceDep = Annotated[PaymentService, Depends(get_payment_service)]


def get_optional_supabase() -> Any:
    """Get Supabase client, returning None if not available."""
    try:
        return get_supabase()
    except RuntimeError:
        return None


def get_optional_redis() -> Any:
    """Get Redis client, returning None if not available."""
    try:
        return get_redis()
    except RuntimeError:
        return None


def get_payment_service_optional(
    settings: Annotated[Settings, Depends(get_settings)],
    supabase: Annotated[Any, Depends(get_optional_supabase)],
    redis: Annotated[Any, Depends(get_optional_redis)],
) -> PaymentService:
    """Dependency to get the payment service with optional clients."""
    return PaymentService(
        settings=settings,
        supabase=supabase,
        redis=redis,
    )


PaymentServiceOptionalDep = Annotated[PaymentService, Depends(get_payment_service_optional)]


@router.post(
    "/create",
    response_model=CreatePaymentResponse,
    summary="Create a payment",
    description=(
        "Create a new payment using the specified provider (Stripe or PayPal). "
        "Supports idempotency keys for safe retries."
    ),
    responses={
        200: {"description": "Payment created successfully"},
        400: {"description": "Invalid request or payment failed"},
        401: {"description": "Missing or invalid API key"},
        429: {"description": "Rate limit exceeded"},
        502: {"description": "Provider error"},
    },
)
async def create_payment(
    request: Request,
    body: CreatePaymentRequest,
    service: PaymentServiceOptionalDep,
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> CreatePaymentResponse:
    """Create a new payment.

    Processes a payment through the specified provider (Stripe or PayPal).
    The response includes the provider's transaction ID and status.

    For Stripe payments, a `client_secret` is returned for frontend confirmation.

    Args:
        request: FastAPI request object.
        body: Payment creation request body.
        service: Payment service instance.
        idempotency_key: Optional idempotency key for safe retries.

    Returns:
        CreatePaymentResponse with payment details.
    """
    # Get customer ID from auth context if available
    customer_id = None
    if hasattr(request.state, "auth") and request.state.auth:
        customer_id = request.state.auth.customer_id

    logger.info(
        "Creating payment",
        provider=body.provider.value,
        amount=body.amount,
        currency=body.currency,
        has_idempotency_key=bool(idempotency_key),
    )

    return await service.create_payment(
        request=body,
        customer_id=customer_id,
        idempotency_key=idempotency_key,
    )


@router.post(
    "/{payment_id}/refund",
    response_model=RefundPaymentResponse,
    summary="Refund a payment",
    description="Refund a payment (full or partial). Supports idempotency keys.",
    responses={
        200: {"description": "Refund processed successfully"},
        400: {"description": "Refund failed"},
        404: {"description": "Payment not found"},
        401: {"description": "Missing or invalid API key"},
        429: {"description": "Rate limit exceeded"},
        502: {"description": "Provider error"},
    },
)
async def refund_payment(
    request: Request,
    payment_id: str,
    body: RefundPaymentRequest,
    service: PaymentServiceOptionalDep,
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> RefundPaymentResponse:
    """Refund a payment.

    Processes a refund through the original payment provider.
    If no amount is specified, a full refund is issued.

    Args:
        request: FastAPI request object.
        payment_id: ID of the payment to refund.
        body: Refund request body.
        service: Payment service instance.
        idempotency_key: Optional idempotency key for safe retries.

    Returns:
        RefundPaymentResponse with refund details.
    """
    # Get customer ID from auth context if available
    customer_id = None
    if hasattr(request.state, "auth") and request.state.auth:
        customer_id = request.state.auth.customer_id

    logger.info(
        "Processing refund",
        payment_id=payment_id,
        amount=body.amount,
        has_idempotency_key=bool(idempotency_key),
    )

    return await service.refund_payment(
        payment_id=payment_id,
        request=body,
        customer_id=customer_id,
        idempotency_key=idempotency_key,
    )


@router.get(
    "/{payment_id}",
    response_model=PaymentStatusResponse,
    summary="Get payment status",
    description="Retrieve the current status of a payment.",
    responses={
        200: {"description": "Payment status retrieved"},
        404: {"description": "Payment not found"},
        401: {"description": "Missing or invalid API key"},
        429: {"description": "Rate limit exceeded"},
    },
)
async def get_payment_status(
    payment_id: str,
    service: PaymentServiceOptionalDep,
) -> PaymentStatusResponse:
    """Get the current status of a payment.

    Retrieves the payment from the database and optionally syncs
    the status with the payment provider.

    Args:
        payment_id: ID of the payment to check.
        service: Payment service instance.

    Returns:
        PaymentStatusResponse with current status.
    """
    logger.info(
        "Checking payment status",
        payment_id=payment_id,
    )

    return await service.check_payment_status(payment_id)


@router.get(
    "",
    response_model=ListPaymentsResponse,
    summary="List payments",
    description="List payments with optional filtering and pagination.",
    responses={
        200: {"description": "Payments listed successfully"},
        401: {"description": "Missing or invalid API key"},
        429: {"description": "Rate limit exceeded"},
    },
)
async def list_payments(
    service: PaymentServiceOptionalDep,
    provider: Annotated[PaymentProvider | None, Query(description="Filter by provider")] = None,
    status: Annotated[PaymentStatus | None, Query(description="Filter by status")] = None,
    customer_id: Annotated[str | None, Query(description="Filter by customer ID")] = None,
    start_date: Annotated[str | None, Query(description="Filter by start date (ISO 8601)")] = None,
    end_date: Annotated[str | None, Query(description="Filter by end date (ISO 8601)")] = None,
    limit: Annotated[int, Query(ge=1, le=100, description="Maximum results")] = 10,
    offset: Annotated[int, Query(ge=0, description="Results to skip")] = 0,
) -> ListPaymentsResponse:
    """List payments with optional filters.

    Supports filtering by provider, status, customer ID, and date range.
    Results are paginated with configurable limit and offset.

    Args:
        service: Payment service instance.
        provider: Optional filter by payment provider.
        status: Optional filter by payment status.
        customer_id: Optional filter by customer ID.
        start_date: Optional filter by start date (inclusive).
        end_date: Optional filter by end date (inclusive).
        limit: Maximum number of results (1-100, default 10).
        offset: Number of results to skip (default 0).

    Returns:
        ListPaymentsResponse with paginated results.
    """
    logger.info(
        "Listing payments",
        provider=provider.value if provider else None,
        status=status.value if status else None,
        customer_id=customer_id,
        limit=limit,
        offset=offset,
    )

    request = ListPaymentsRequest(
        provider=provider,
        status=status,
        customer_id=customer_id,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
        offset=offset,
    )

    return await service.list_payments(request)
