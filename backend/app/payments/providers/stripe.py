"""Stripe payment provider adapter.

Implements the PaymentProviderAdapter interface for Stripe payments.
Uses the official Stripe Python SDK.
"""

from __future__ import annotations

from typing import Any

import stripe
from stripe import PaymentIntent, Refund
from stripe._error import InvalidRequestError, StripeError

from app.config import Settings
from app.logging import get_logger
from app.payments.errors import (
    PaymentFailedError,
    PaymentNotFoundError,
    ProviderError,
    RefundFailedError,
)
from app.payments.providers.base import (
    PaymentProviderAdapter,
    ProviderPaymentResult,
    ProviderRefundResult,
    ProviderStatusResult,
)
from app.payments.types import PaymentStatus

logger = get_logger("payments.stripe")


class StripeAdapter(PaymentProviderAdapter):
    """Stripe payment provider adapter.

    Handles payment creation, refunds, and status checks via Stripe API.
    """

    def __init__(self, settings: Settings) -> None:
        """Initialize the Stripe adapter.

        Args:
            settings: Application settings containing Stripe API key.

        Raises:
            ValueError: If Stripe API key is not configured.
        """
        if not settings.stripe_api_key:
            raise ValueError("STRIPE_API_KEY is not configured")

        self.api_key = settings.stripe_api_key
        stripe.api_key = self.api_key
        stripe.api_version = "2024-11-20.acacia"

    @property
    def provider_name(self) -> str:
        """Return the provider name."""
        return "stripe"

    def _map_stripe_status(self, stripe_status: str) -> PaymentStatus:
        """Map Stripe PaymentIntent status to our PaymentStatus.

        Args:
            stripe_status: Stripe's payment intent status.

        Returns:
            Mapped PaymentStatus.
        """
        status_map = {
            "requires_payment_method": PaymentStatus.PENDING,
            "requires_confirmation": PaymentStatus.PENDING,
            "requires_action": PaymentStatus.PENDING,
            "processing": PaymentStatus.PROCESSING,
            "requires_capture": PaymentStatus.PROCESSING,
            "canceled": PaymentStatus.FAILED,
            "succeeded": PaymentStatus.COMPLETED,
        }
        return status_map.get(stripe_status, PaymentStatus.PENDING)

    def _map_refund_status(self, refund_status: str) -> PaymentStatus:
        """Map Stripe Refund status to our PaymentStatus.

        Args:
            refund_status: Stripe's refund status.

        Returns:
            Mapped PaymentStatus.
        """
        status_map = {
            "succeeded": PaymentStatus.REFUNDED,
            "pending": PaymentStatus.PROCESSING,
            "failed": PaymentStatus.FAILED,
            "canceled": PaymentStatus.FAILED,
            "requires_action": PaymentStatus.PROCESSING,
        }
        return status_map.get(refund_status, PaymentStatus.PROCESSING)

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
        """Create a payment via Stripe PaymentIntent.

        Creates a PaymentIntent and optionally confirms it if payment_method
        starts with 'pm_' (indicating a saved payment method).

        Args:
            amount: Amount in smallest currency unit.
            currency: Three-letter ISO currency code.
            payment_method: Stripe payment method ID or token.
            customer_id: Customer identifier for metadata.
            description: Optional payment description.
            metadata: Optional metadata.
            idempotency_key: Optional idempotency key.

        Returns:
            ProviderPaymentResult with transaction details.

        Raises:
            PaymentFailedError: If the payment fails.
            ProviderError: If there's a Stripe API error.
        """
        normalized_currency = self.normalize_currency(currency)

        try:
            logger.info(
                "Creating Stripe PaymentIntent",
                amount=amount,
                currency=normalized_currency,
                payment_method=payment_method[:20] + "..."
                if len(payment_method) > 20
                else payment_method,
            )

            # Build metadata for Stripe
            stripe_metadata: dict[str, str] = {
                "customer_id": customer_id,
            }
            if metadata:
                # Stripe metadata must be strings
                for key, value in metadata.items():
                    stripe_metadata[key] = str(value)

            # Create PaymentIntent params
            intent_params: dict[str, Any] = {
                "amount": amount,
                "currency": normalized_currency.lower(),
                "payment_method": payment_method,
                "metadata": stripe_metadata,
                "confirm": True,  # Auto-confirm for server-side payments
                "automatic_payment_methods": {
                    "enabled": True,
                    "allow_redirects": "never",
                },
            }

            if description:
                intent_params["description"] = description

            # Add idempotency key if provided
            request_options: dict[str, Any] = {}
            if idempotency_key:
                request_options["idempotency_key"] = idempotency_key

            # Create the PaymentIntent
            payment_intent: PaymentIntent = stripe.PaymentIntent.create(
                **intent_params,
                **request_options,
            )

            logger.info(
                "Stripe PaymentIntent created",
                payment_intent_id=payment_intent.id,
                status=payment_intent.status,
            )

            return ProviderPaymentResult(
                provider_transaction_id=payment_intent.id,
                status=self._map_stripe_status(payment_intent.status),
                client_secret=payment_intent.client_secret,
                provider_metadata={
                    "stripe_status": payment_intent.status,
                    "payment_method_types": payment_intent.payment_method_types,
                    "livemode": payment_intent.livemode,
                },
            )

        except InvalidRequestError as e:
            logger.error(
                "Stripe invalid request error",
                error=str(e),
                code=e.code,
                param=e.param,
            )
            raise PaymentFailedError(
                message=f"Payment failed: {e.user_message or str(e)}",
                details={
                    "provider": "stripe",
                    "stripe_code": e.code,
                    "stripe_param": e.param,
                },
            )
        except StripeError as e:
            logger.error(
                "Stripe API error",
                error=str(e),
                error_type=type(e).__name__,
            )
            raise ProviderError(
                provider="stripe",
                message=f"Stripe error: {e.user_message or str(e)}",
                details={
                    "stripe_error_type": type(e).__name__,
                },
            )

    async def refund_payment(
        self,
        provider_transaction_id: str,
        amount: int | None = None,
        reason: str | None = None,
        idempotency_key: str | None = None,
    ) -> ProviderRefundResult:
        """Refund a Stripe payment.

        Args:
            provider_transaction_id: Stripe PaymentIntent ID.
            amount: Optional partial refund amount. If None, full refund.
            reason: Optional refund reason.
            idempotency_key: Optional idempotency key.

        Returns:
            ProviderRefundResult with refund details.

        Raises:
            RefundFailedError: If the refund fails.
            PaymentNotFoundError: If the PaymentIntent doesn't exist.
            ProviderError: If there's a Stripe API error.
        """
        try:
            logger.info(
                "Creating Stripe refund",
                payment_intent=provider_transaction_id,
                amount=amount,
            )

            refund_params: dict[str, Any] = {
                "payment_intent": provider_transaction_id,
            }

            if amount is not None:
                refund_params["amount"] = amount

            if reason:
                # Stripe accepts: duplicate, fraudulent, requested_by_customer
                stripe_reason = "requested_by_customer"
                if "duplicate" in reason.lower():
                    stripe_reason = "duplicate"
                elif "fraud" in reason.lower():
                    stripe_reason = "fraudulent"
                refund_params["reason"] = stripe_reason
                refund_params["metadata"] = {"original_reason": reason}

            # Add idempotency key if provided
            request_options: dict[str, Any] = {}
            if idempotency_key:
                request_options["idempotency_key"] = idempotency_key

            refund: Refund = stripe.Refund.create(
                **refund_params,
                **request_options,
            )

            logger.info(
                "Stripe refund created",
                refund_id=refund.id,
                status=refund.status,
                amount=refund.amount,
            )

            return ProviderRefundResult(
                refund_id=refund.id,
                status=self._map_refund_status(refund.status),
                amount=refund.amount,
                provider_metadata={
                    "stripe_status": refund.status,
                    "stripe_reason": refund.reason,
                    "livemode": refund.livemode,
                },
            )

        except InvalidRequestError as e:
            logger.error(
                "Stripe refund invalid request",
                error=str(e),
                code=e.code,
            )
            # Check if payment not found
            if e.code == "resource_missing":
                raise PaymentNotFoundError(
                    payment_id=provider_transaction_id,
                    details={"provider": "stripe"},
                )
            raise RefundFailedError(
                message=f"Refund failed: {e.user_message or str(e)}",
                details={
                    "provider": "stripe",
                    "stripe_code": e.code,
                },
            )
        except StripeError as e:
            logger.error(
                "Stripe refund API error",
                error=str(e),
            )
            raise ProviderError(
                provider="stripe",
                message=f"Stripe refund error: {e.user_message or str(e)}",
            )

    async def get_payment_status(
        self,
        provider_transaction_id: str,
    ) -> ProviderStatusResult:
        """Get the current status of a Stripe payment.

        Args:
            provider_transaction_id: Stripe PaymentIntent ID.

        Returns:
            ProviderStatusResult with current status.

        Raises:
            PaymentNotFoundError: If the PaymentIntent doesn't exist.
            ProviderError: If there's a Stripe API error.
        """
        try:
            logger.info(
                "Fetching Stripe PaymentIntent status",
                payment_intent=provider_transaction_id,
            )

            payment_intent = stripe.PaymentIntent.retrieve(provider_transaction_id)

            # Check for refunds
            status = self._map_stripe_status(payment_intent.status)

            # If there are charges, check if any are refunded
            if payment_intent.latest_charge:
                charge = stripe.Charge.retrieve(payment_intent.latest_charge)
                if charge.refunded:
                    status = PaymentStatus.REFUNDED

            return ProviderStatusResult(
                status=status,
                provider_metadata={
                    "stripe_status": payment_intent.status,
                    "amount_received": payment_intent.amount_received,
                    "livemode": payment_intent.livemode,
                },
            )

        except InvalidRequestError as e:
            if e.code == "resource_missing":
                raise PaymentNotFoundError(
                    payment_id=provider_transaction_id,
                    details={"provider": "stripe"},
                )
            raise ProviderError(
                provider="stripe",
                message=f"Stripe error: {e.user_message or str(e)}",
            )
        except StripeError as e:
            raise ProviderError(
                provider="stripe",
                message=f"Stripe error: {e.user_message or str(e)}",
            )
