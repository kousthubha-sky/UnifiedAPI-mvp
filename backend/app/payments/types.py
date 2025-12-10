"""Payment types and Pydantic models.

Mirrors the TypeScript types from sdk/src/types.ts for API compatibility.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class PaymentProvider(str, Enum):
    """Supported payment providers."""

    STRIPE = "stripe"
    PAYPAL = "paypal"


class PaymentStatus(str, Enum):
    """Payment status values."""

    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"
    PROCESSING = "processing"


class CreatePaymentRequest(BaseModel):
    """Request model for creating a payment (SDK compatible)."""

    amount: int = Field(
        ...,
        gt=0,
        description="Amount in the smallest currency unit (cents for USD)",
    )
    currency: str = Field(
        ...,
        min_length=3,
        max_length=3,
        description="Three-letter ISO currency code (e.g., 'USD', 'EUR')",
    )
    description: str | None = Field(
        default=None,
        description="Optional description",
    )
    customer_email: str | None = Field(
        default=None,
        description="Optional customer email",
    )
    customer_name: str | None = Field(
        default=None,
        description="Optional customer name",
    )
    metadata: dict[str, Any] | None = Field(
        default=None,
        description="Optional metadata",
    )


class CreatePaymentResponse(BaseModel):
    """Response model for a created payment."""

    id: str = Field(..., description="Internal payment ID")
    provider_transaction_id: str = Field(..., description="Provider's transaction ID")
    amount: int = Field(..., description="Payment amount")
    currency: str = Field(..., description="Currency code")
    status: PaymentStatus = Field(..., description="Payment status")
    created_at: str = Field(..., description="Creation timestamp (ISO 8601)")
    trace_id: str | None = Field(default=None, description="Request trace ID")
    metadata: dict[str, Any] | None = Field(default=None, description="Custom metadata")
    provider_metadata: dict[str, Any] | None = Field(
        default=None,
        description="Provider-specific metadata",
    )
    client_secret: str | None = Field(
        default=None,
        description="Client secret for Stripe PaymentIntent (frontend confirmation)",
    )


class RefundPaymentRequest(BaseModel):
    """Request model for refunding a payment."""

    amount: int | None = Field(
        default=None,
        gt=0,
        description="Optional partial refund amount (defaults to full refund)",
    )
    reason: str | None = Field(
        default=None,
        description="Reason for refund",
    )


class RefundPaymentResponse(BaseModel):
    """Response model for a refund."""

    refund_id: str = Field(..., description="Refund ID")
    original_transaction_id: str = Field(..., description="Original transaction ID")
    amount: int = Field(..., description="Refunded amount")
    status: PaymentStatus = Field(..., description="Refund status")
    created_at: str = Field(..., description="Creation timestamp (ISO 8601)")
    trace_id: str | None = Field(default=None, description="Request trace ID")
    provider_metadata: dict[str, Any] | None = Field(
        default=None,
        description="Provider-specific metadata",
    )


class ListPaymentsRequest(BaseModel):
    """Request model for listing payments."""

    provider: PaymentProvider | None = Field(default=None, description="Filter by provider")
    status: PaymentStatus | None = Field(default=None, description="Filter by status")
    customer_id: str | None = Field(default=None, description="Filter by customer ID")
    start_date: str | None = Field(default=None, description="Filter by start date (ISO 8601)")
    end_date: str | None = Field(default=None, description="Filter by end date (ISO 8601)")
    limit: int = Field(default=10, ge=1, le=100, description="Maximum results to return")
    offset: int = Field(default=0, ge=0, description="Number of results to skip")


class PaymentRecord(BaseModel):
    """A payment record from the database."""

    id: str = Field(..., description="Internal payment ID")
    provider_transaction_id: str = Field(..., description="Provider's transaction ID")
    provider: PaymentProvider = Field(..., description="Payment provider")
    amount: int = Field(..., description="Payment amount")
    currency: str = Field(..., description="Currency code")
    status: PaymentStatus = Field(..., description="Payment status")
    customer_id: str | None = Field(default=None, description="Customer ID")
    metadata: dict[str, Any] | None = Field(default=None, description="Custom metadata")
    refund_id: str | None = Field(default=None, description="Refund ID if refunded")
    refund_status: str | None = Field(default=None, description="Refund status")
    refund_amount: int | None = Field(default=None, description="Refund amount")
    created_at: str = Field(..., description="Creation timestamp (ISO 8601)")
    updated_at: str = Field(..., description="Last update timestamp (ISO 8601)")


class ListPaymentsResponse(BaseModel):
    """Response model for listing payments."""

    payments: list[PaymentRecord] = Field(..., description="Array of payment records")
    total: int = Field(..., description="Total count of matching records")
    limit: int = Field(..., description="Current limit")
    offset: int = Field(..., description="Current offset")
    trace_id: str | None = Field(default=None, description="Request trace ID")


class PaymentStatusResponse(BaseModel):
    """Response model for checking payment status."""

    id: str = Field(..., description="Internal payment ID")
    provider_transaction_id: str = Field(..., description="Provider's transaction ID")
    provider: PaymentProvider = Field(..., description="Payment provider")
    status: PaymentStatus = Field(..., description="Payment status")
    amount: int = Field(..., description="Payment amount")
    currency: str = Field(..., description="Currency code")
    created_at: str = Field(..., description="Creation timestamp")
    updated_at: str = Field(..., description="Last update timestamp")
    trace_id: str | None = Field(default=None, description="Request trace ID")
    refund_id: str | None = Field(default=None, description="Refund ID if refunded")
    refund_status: str | None = Field(default=None, description="Refund status")
    refund_amount: int | None = Field(default=None, description="Refund amount")


def datetime_to_iso(dt: datetime | str | None) -> str:
    """Convert a datetime to ISO 8601 string.

    Args:
        dt: A datetime object, ISO string, or None.

    Returns:
        ISO 8601 formatted string.
    """
    if dt is None:
        return datetime.now().isoformat()
    if isinstance(dt, str):
        return dt
    return dt.isoformat()
