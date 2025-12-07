"""Base payment provider adapter interface.

Defines the abstract interface that all payment provider adapters must implement.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from app.payments.types import PaymentStatus


@dataclass
class ProviderPaymentResult:
    """Result from a payment provider's create payment operation."""

    provider_transaction_id: str
    status: PaymentStatus
    client_secret: str | None = None
    provider_metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class ProviderRefundResult:
    """Result from a payment provider's refund operation."""

    refund_id: str
    status: PaymentStatus
    amount: int
    provider_metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class ProviderStatusResult:
    """Result from a payment provider's status check."""

    status: PaymentStatus
    provider_metadata: dict[str, Any] = field(default_factory=dict)


class PaymentProviderAdapter(ABC):
    """Abstract base class for payment provider adapters.

    Each payment provider (Stripe, PayPal, etc.) should implement this interface
    to provide a consistent API for payment operations.
    """

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Return the provider name (e.g., 'stripe', 'paypal')."""
        ...

    @abstractmethod
    async def create_payment(
        self,
        amount: int,
        currency: str,
        payment_method: str,
        customer_id: str,
        description: str | None = None,
        metadata: dict[str, Any] | None = None,
        idempotency_key: str | None = None,
    ) -> ProviderPaymentResult:
        """Create a payment with the provider.

        Args:
            amount: Amount in smallest currency unit (e.g., cents).
            currency: Three-letter ISO currency code.
            payment_method: Provider-specific payment method identifier.
            customer_id: Customer identifier.
            description: Optional payment description.
            metadata: Optional metadata to attach to the payment.
            idempotency_key: Optional idempotency key for the request.

        Returns:
            ProviderPaymentResult with transaction details.

        Raises:
            PaymentFailedError: If the payment fails.
            ProviderError: If there's a provider-specific error.
        """
        ...

    @abstractmethod
    async def refund_payment(
        self,
        provider_transaction_id: str,
        amount: int | None = None,
        reason: str | None = None,
        idempotency_key: str | None = None,
    ) -> ProviderRefundResult:
        """Refund a payment.

        Args:
            provider_transaction_id: The provider's transaction ID.
            amount: Optional partial refund amount. If None, full refund.
            reason: Optional refund reason.
            idempotency_key: Optional idempotency key for the request.

        Returns:
            ProviderRefundResult with refund details.

        Raises:
            RefundFailedError: If the refund fails.
            PaymentNotFoundError: If the payment doesn't exist.
            ProviderError: If there's a provider-specific error.
        """
        ...

    @abstractmethod
    async def get_payment_status(
        self,
        provider_transaction_id: str,
    ) -> ProviderStatusResult:
        """Get the current status of a payment.

        Args:
            provider_transaction_id: The provider's transaction ID.

        Returns:
            ProviderStatusResult with current status.

        Raises:
            PaymentNotFoundError: If the payment doesn't exist.
            ProviderError: If there's a provider-specific error.
        """
        ...

    def normalize_currency(self, currency: str) -> str:
        """Normalize currency code to uppercase.

        Args:
            currency: Currency code.

        Returns:
            Uppercase currency code.
        """
        return currency.upper()

    def is_zero_decimal_currency(self, currency: str) -> bool:
        """Check if currency uses zero decimal places.

        Some currencies (JPY, KRW, etc.) don't use cents.

        Args:
            currency: Currency code.

        Returns:
            True if currency is zero-decimal.
        """
        zero_decimal_currencies = {
            "BIF",
            "CLP",
            "DJF",
            "GNF",
            "JPY",
            "KMF",
            "KRW",
            "MGA",
            "PYG",
            "RWF",
            "UGX",
            "VND",
            "VUV",
            "XAF",
            "XOF",
            "XPF",
        }
        return currency.upper() in zero_decimal_currencies
