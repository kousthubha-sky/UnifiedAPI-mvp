"""Payment-specific error types.

Extends the base APIError with payment-specific error classes.
These match the error codes expected by the SDK/frontend.
"""

from __future__ import annotations

from typing import Any

from app.errors import APIError, ErrorCode


class PaymentFailedError(APIError):
    """Raised when a payment operation fails."""

    def __init__(
        self,
        message: str = "Payment failed",
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(
            code=ErrorCode.PAYMENT_FAILED,
            message=message,
            status_code=400,
            details=details,
        )


class RefundFailedError(APIError):
    """Raised when a refund operation fails."""

    def __init__(
        self,
        message: str = "Refund failed",
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(
            code=ErrorCode.REFUND_FAILED,
            message=message,
            status_code=400,
            details=details,
        )


class ProviderError(APIError):
    """Raised when a payment provider returns an error."""

    def __init__(
        self,
        provider: str,
        message: str = "Provider error",
        details: dict[str, Any] | None = None,
    ) -> None:
        base_details = {"provider": provider}
        if details:
            base_details.update(details)
        super().__init__(
            code=ErrorCode.PROVIDER_ERROR,
            message=message,
            status_code=502,
            details=base_details,
        )


class PaymentNotFoundError(APIError):
    """Raised when a payment is not found."""

    def __init__(
        self,
        payment_id: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        base_details = {"payment_id": payment_id}
        if details:
            base_details.update(details)
        super().__init__(
            code=ErrorCode.PAYMENT_NOT_FOUND,
            message=f"Payment not found: {payment_id}",
            status_code=404,
            details=base_details,
        )


class InvalidProviderError(APIError):
    """Raised when an invalid payment provider is specified."""

    def __init__(
        self,
        provider: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        base_details = {"provider": provider, "valid_providers": ["stripe", "paypal"]}
        if details:
            base_details.update(details)
        super().__init__(
            code=ErrorCode.INVALID_PROVIDER,
            message=f"Invalid payment provider: {provider}",
            status_code=400,
            details=base_details,
        )
