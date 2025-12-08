"""Payment service module.

Provides high-level payment operations with:
- Provider adapter selection (Stripe/PayPal)
- Idempotency caching via Redis
- Database persistence via Supabase
- Audit logging
"""

from __future__ import annotations

import json
import time
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from supabase import Client as SupabaseClient

from app.config import Settings
from app.app_logging import get_logger, get_trace_id
from app.payments.audit import (
    log_payment_failure,
    log_payment_success,
    log_refund_failure,
    log_refund_success,
)
from app.payments.errors import (
    InvalidProviderError,
    PaymentNotFoundError,
)
from app.payments.providers.base import PaymentProviderAdapter
from app.payments.providers.paypal import PayPalAdapter
from app.payments.providers.stripe import StripeAdapter
from app.payments.types import (
    CreatePaymentRequest,
    CreatePaymentResponse,
    ListPaymentsRequest,
    ListPaymentsResponse,
    PaymentProvider,
    PaymentRecord,
    PaymentStatus,
    PaymentStatusResponse,
    RefundPaymentRequest,
    RefundPaymentResponse,
    datetime_to_iso,
)

logger = get_logger("payments.service")

# Idempotency cache key prefix and TTL
IDEMPOTENCY_PREFIX = "idempotency:"
IDEMPOTENCY_TTL_SECONDS = 86400  # 24 hours


class PaymentService:
    """Payment service for processing payments across providers.

    Handles:
    - Provider selection and adapter management
    - Idempotency via Redis caching
    - Database persistence via Supabase
    - Audit logging for all operations
    """

    def __init__(
        self,
        settings: Settings,
        supabase: SupabaseClient | None = None,
        redis: Any = None,
    ) -> None:
        """Initialize the payment service.

        Args:
            settings: Application settings.
            supabase: Supabase client for database operations.
            redis: Redis client for idempotency caching.
        """
        self.settings = settings
        self.supabase = supabase
        self.redis = redis
        self._adapters: dict[str, PaymentProviderAdapter] = {}

    def _get_adapter(self, provider: PaymentProvider) -> PaymentProviderAdapter:
        """Get or create a payment provider adapter.

        Args:
            provider: The payment provider.

        Returns:
            The payment provider adapter.

        Raises:
            InvalidProviderError: If the provider is not supported or not configured.
        """
        provider_name = provider.value

        if provider_name in self._adapters:
            return self._adapters[provider_name]

        try:
            if provider == PaymentProvider.STRIPE:
                adapter = StripeAdapter(self.settings)
            elif provider == PaymentProvider.PAYPAL:
                adapter = PayPalAdapter(self.settings)
            else:
                raise InvalidProviderError(provider_name)

            self._adapters[provider_name] = adapter
            return adapter

        except ValueError as e:
            logger.error(
                "Provider not configured",
                provider=provider_name,
                error=str(e),
            )
            raise InvalidProviderError(
                provider_name,
                details={
                    "error": str(e),
                    "hint": f"Configure {provider_name.upper()}_* environment variables",
                },
            )

    async def _get_cached_response(self, idempotency_key: str) -> dict[str, Any] | None:
        """Get a cached response by idempotency key.

        Args:
            idempotency_key: The idempotency key.

        Returns:
            Cached response dict or None if not found.
        """
        if not self.redis or not idempotency_key:
            return None

        try:
            cache_key = f"{IDEMPOTENCY_PREFIX}{idempotency_key}"
            cached = await self.redis.get(cache_key)
            if cached:
                logger.info(
                    "Idempotency cache hit",
                    idempotency_key=idempotency_key,
                )
                return json.loads(cached)
        except Exception as e:
            logger.warning(
                "Failed to read idempotency cache",
                idempotency_key=idempotency_key,
                error=str(e),
            )

        return None

    async def _set_cached_response(
        self,
        idempotency_key: str,
        response: dict[str, Any],
    ) -> None:
        """Cache a response by idempotency key.

        Args:
            idempotency_key: The idempotency key.
            response: The response to cache.
        """
        if not self.redis or not idempotency_key:
            return

        try:
            cache_key = f"{IDEMPOTENCY_PREFIX}{idempotency_key}"
            await self.redis.set(
                cache_key,
                json.dumps(response),
                ex=IDEMPOTENCY_TTL_SECONDS,
            )
            logger.debug(
                "Idempotency response cached",
                idempotency_key=idempotency_key,
            )
        except Exception as e:
            logger.warning(
                "Failed to write idempotency cache",
                idempotency_key=idempotency_key,
                error=str(e),
            )

    async def create_payment(
        self,
        request: CreatePaymentRequest,
        customer_id: str | None = None,
        idempotency_key: str | None = None,
    ) -> CreatePaymentResponse:
        """Create a new payment.

        Args:
            request: Payment creation request.
            customer_id: Optional customer ID from auth context.
            idempotency_key: Optional idempotency key for replay protection.

        Returns:
            CreatePaymentResponse with payment details.

        Raises:
            PaymentFailedError: If the payment fails.
            InvalidProviderError: If the provider is not valid.
            ProviderError: If there's a provider error.
        """
        start_time = time.perf_counter()
        trace_id = get_trace_id()

        # Check idempotency cache
        if idempotency_key:
            cached = await self._get_cached_response(idempotency_key)
            if cached:
                return CreatePaymentResponse(**cached)

        try:
            # Get provider adapter
            adapter = self._get_adapter(request.provider)

            # Create payment with provider
            result = await adapter.create_payment(
                amount=request.amount,
                currency=request.currency,
                payment_method=request.payment_method,
                customer_id=request.customer_id,
                description=request.description,
                metadata=request.metadata,
                idempotency_key=idempotency_key,
            )

            # Generate internal payment ID
            payment_id = str(uuid4())
            created_at = datetime.now(UTC).isoformat()

            # Save to database
            if self.supabase:
                await self._save_payment_to_db(
                    payment_id=payment_id,
                    provider=request.provider.value,
                    provider_transaction_id=result.provider_transaction_id,
                    amount=request.amount,
                    currency=request.currency.upper(),
                    status=result.status.value,
                    customer_id=request.customer_id,
                    metadata=request.metadata,
                    created_at=created_at,
                )

            # Build response
            response = CreatePaymentResponse(
                id=payment_id,
                provider_transaction_id=result.provider_transaction_id,
                amount=request.amount,
                currency=request.currency.upper(),
                status=result.status,
                created_at=created_at,
                trace_id=trace_id,
                metadata=request.metadata,
                provider_metadata=result.provider_metadata,
                client_secret=result.client_secret,
            )

            # Cache response for idempotency
            if idempotency_key:
                await self._set_cached_response(
                    idempotency_key,
                    response.model_dump(),
                )

            # Audit log success
            latency_ms = int((time.perf_counter() - start_time) * 1000)
            await log_payment_success(
                supabase=self.supabase,
                customer_id=customer_id or request.customer_id,
                endpoint="/api/v1/payments/create",
                method="POST",
                provider=request.provider.value,
                provider_transaction_id=result.provider_transaction_id,
                amount=request.amount,
                currency=request.currency,
                latency_ms=latency_ms,
                request_body=request.model_dump(),
            )

            logger.info(
                "Payment created successfully",
                payment_id=payment_id,
                provider=request.provider.value,
                provider_transaction_id=result.provider_transaction_id,
                amount=request.amount,
                currency=request.currency,
            )

            return response

        except Exception as e:
            # Audit log failure
            latency_ms = int((time.perf_counter() - start_time) * 1000)
            await log_payment_failure(
                supabase=self.supabase,
                customer_id=customer_id or request.customer_id,
                endpoint="/api/v1/payments/create",
                method="POST",
                provider=request.provider.value,
                error_message=str(e),
                status=getattr(e, "status_code", 500),
                latency_ms=latency_ms,
                request_body=request.model_dump(),
            )
            raise

    async def refund_payment(
        self,
        payment_id: str,
        request: RefundPaymentRequest,
        customer_id: str | None = None,
        idempotency_key: str | None = None,
    ) -> RefundPaymentResponse:
        """Refund a payment.

        Args:
            payment_id: The payment ID to refund.
            request: Refund request parameters.
            customer_id: Optional customer ID from auth context.
            idempotency_key: Optional idempotency key.

        Returns:
            RefundPaymentResponse with refund details.

        Raises:
            PaymentNotFoundError: If the payment is not found.
            RefundFailedError: If the refund fails.
        """
        start_time = time.perf_counter()
        trace_id = get_trace_id()

        # Check idempotency cache
        if idempotency_key:
            cached = await self._get_cached_response(idempotency_key)
            if cached:
                return RefundPaymentResponse(**cached)

        # Get payment from database
        payment = await self._get_payment_from_db(payment_id)

        try:
            # Get provider adapter
            provider = PaymentProvider(payment["provider"])
            adapter = self._get_adapter(provider)

            # Process refund with provider
            result = await adapter.refund_payment(
                provider_transaction_id=payment["provider_transaction_id"],
                amount=request.amount,
                reason=request.reason,
                idempotency_key=idempotency_key,
            )

            # Update payment in database
            if self.supabase:
                await self._update_payment_refund(
                    payment_id=payment_id,
                    refund_id=result.refund_id,
                    refund_status=result.status.value,
                    refund_amount=result.amount,
                )

            # Build response
            response = RefundPaymentResponse(
                refund_id=result.refund_id,
                original_transaction_id=payment["provider_transaction_id"],
                amount=result.amount,
                status=result.status,
                created_at=datetime.now(UTC).isoformat(),
                trace_id=trace_id,
                provider_metadata=result.provider_metadata,
            )

            # Cache response for idempotency
            if idempotency_key:
                await self._set_cached_response(
                    idempotency_key,
                    response.model_dump(),
                )

            # Audit log success
            latency_ms = int((time.perf_counter() - start_time) * 1000)
            await log_refund_success(
                supabase=self.supabase,
                customer_id=customer_id or payment.get("customer_id"),
                endpoint=f"/api/v1/payments/{payment_id}/refund",
                method="POST",
                provider=payment["provider"],
                refund_id=result.refund_id,
                original_transaction_id=payment["provider_transaction_id"],
                amount=result.amount,
                latency_ms=latency_ms,
            )

            logger.info(
                "Payment refunded successfully",
                payment_id=payment_id,
                refund_id=result.refund_id,
                amount=result.amount,
            )

            return response

        except Exception as e:
            # Audit log failure
            latency_ms = int((time.perf_counter() - start_time) * 1000)
            await log_refund_failure(
                supabase=self.supabase,
                customer_id=customer_id or payment.get("customer_id"),
                endpoint=f"/api/v1/payments/{payment_id}/refund",
                method="POST",
                provider=payment.get("provider"),
                error_message=str(e),
                status=getattr(e, "status_code", 500),
                latency_ms=latency_ms,
            )
            raise

    async def check_payment_status(
        self,
        payment_id: str,
    ) -> PaymentStatusResponse:
        """Check the status of a payment.

        Args:
            payment_id: The payment ID to check.

        Returns:
            PaymentStatusResponse with current status.

        Raises:
            PaymentNotFoundError: If the payment is not found.
        """
        trace_id = get_trace_id()

        # Get payment from database
        payment = await self._get_payment_from_db(payment_id)

        # Optionally sync status with provider
        try:
            provider = PaymentProvider(payment["provider"])
            adapter = self._get_adapter(provider)
            provider_status = await adapter.get_payment_status(payment["provider_transaction_id"])

            # Update local status if changed
            if provider_status.status.value != payment["status"] and self.supabase:
                self.supabase.table("payments").update(
                    {
                        "status": provider_status.status.value,
                        "updated_at": datetime.now(UTC).isoformat(),
                    }
                ).eq("id", payment_id).execute()
                payment["status"] = provider_status.status.value

        except Exception as e:
            logger.warning(
                "Failed to sync payment status with provider",
                payment_id=payment_id,
                error=str(e),
            )

        return PaymentStatusResponse(
            id=payment["id"],
            provider_transaction_id=payment["provider_transaction_id"],
            provider=PaymentProvider(payment["provider"]),
            status=PaymentStatus(payment["status"]),
            amount=int(payment["amount"]),
            currency=payment["currency"],
            created_at=datetime_to_iso(payment.get("created_at")),
            updated_at=datetime_to_iso(payment.get("updated_at")),
            trace_id=trace_id,
            refund_id=payment.get("refund_id"),
            refund_status=payment.get("refund_status"),
            refund_amount=int(payment["refund_amount"]) if payment.get("refund_amount") else None,
        )

    async def list_payments(
        self,
        request: ListPaymentsRequest,
    ) -> ListPaymentsResponse:
        """List payments with optional filters.

        Args:
            request: List payments request with filters and pagination.

        Returns:
            ListPaymentsResponse with paginated results.
        """
        trace_id = get_trace_id()

        if not self.supabase:
            return ListPaymentsResponse(
                payments=[],
                total=0,
                limit=request.limit,
                offset=request.offset,
                trace_id=trace_id,
            )

        # Build query
        query = self.supabase.table("payments").select("*", count="exact")

        # Apply filters
        if request.provider:
            query = query.eq("provider", request.provider.value)
        if request.status:
            query = query.eq("status", request.status.value)
        if request.customer_id:
            query = query.eq("customer_id", request.customer_id)
        if request.start_date:
            query = query.gte("created_at", request.start_date)
        if request.end_date:
            query = query.lte("created_at", request.end_date)

        # Apply pagination
        query = query.order("created_at", desc=True)
        query = query.range(request.offset, request.offset + request.limit - 1)

        # Execute query
        result = query.execute()

        # Convert to PaymentRecord objects
        payments = []
        for row in result.data:
            payments.append(
                PaymentRecord(
                    id=row["id"],
                    provider_transaction_id=row["provider_transaction_id"],
                    provider=PaymentProvider(row["provider"]),
                    amount=int(row["amount"]),
                    currency=row["currency"],
                    status=PaymentStatus(row["status"]),
                    customer_id=row.get("customer_id"),
                    metadata=row.get("metadata"),
                    refund_id=row.get("refund_id"),
                    refund_status=row.get("refund_status"),
                    refund_amount=int(row["refund_amount"]) if row.get("refund_amount") else None,
                    created_at=datetime_to_iso(row.get("created_at")),
                    updated_at=datetime_to_iso(row.get("updated_at")),
                )
            )

        return ListPaymentsResponse(
            payments=payments,
            total=result.count or 0,
            limit=request.limit,
            offset=request.offset,
            trace_id=trace_id,
        )

    async def _save_payment_to_db(
        self,
        payment_id: str,
        provider: str,
        provider_transaction_id: str,
        amount: int,
        currency: str,
        status: str,
        customer_id: str,
        metadata: dict[str, Any] | None = None,
        created_at: str | None = None,
    ) -> None:
        """Save a payment record to the database.

        Args:
            payment_id: Internal payment ID.
            provider: Payment provider name.
            provider_transaction_id: Provider's transaction ID.
            amount: Payment amount.
            currency: Currency code.
            status: Payment status.
            customer_id: Customer ID.
            metadata: Optional metadata.
            created_at: Creation timestamp.
        """
        if not self.supabase:
            logger.warning("Supabase not configured, skipping payment save")
            return

        try:
            record = {
                "id": payment_id,
                "provider": provider,
                "provider_transaction_id": provider_transaction_id,
                "amount": amount,
                "currency": currency,
                "status": status,
                "customer_id": customer_id,
                "metadata": metadata,
                "created_at": created_at or datetime.now(UTC).isoformat(),
                "updated_at": datetime.now(UTC).isoformat(),
            }

            self.supabase.table("payments").insert(record).execute()

            logger.debug(
                "Payment saved to database",
                payment_id=payment_id,
            )

        except Exception as e:
            logger.error(
                "Failed to save payment to database",
                payment_id=payment_id,
                error=str(e),
            )
            # Don't fail the request if DB save fails
            # The provider payment was already created

    async def _get_payment_from_db(self, payment_id: str) -> dict[str, Any]:
        """Get a payment record from the database.

        Args:
            payment_id: The payment ID.

        Returns:
            Payment record dict.

        Raises:
            PaymentNotFoundError: If the payment is not found.
        """
        if not self.supabase:
            raise PaymentNotFoundError(payment_id, details={"reason": "Database not configured"})

        result = self.supabase.table("payments").select("*").eq("id", payment_id).execute()

        if not result.data:
            # Also try by provider_transaction_id
            result = (
                self.supabase.table("payments")
                .select("*")
                .eq("provider_transaction_id", payment_id)
                .execute()
            )

        if not result.data:
            raise PaymentNotFoundError(payment_id)

        return result.data[0]

    async def _update_payment_refund(
        self,
        payment_id: str,
        refund_id: str,
        refund_status: str,
        refund_amount: int,
    ) -> None:
        """Update a payment record with refund information.

        Args:
            payment_id: The payment ID.
            refund_id: The refund ID.
            refund_status: The refund status.
            refund_amount: The refund amount.
        """
        if not self.supabase:
            return

        try:
            self.supabase.table("payments").update(
                {
                    "refund_id": refund_id,
                    "refund_status": refund_status,
                    "refund_amount": refund_amount,
                    "status": "refunded" if refund_status == "refunded" else "processing",
                    "updated_at": datetime.now(UTC).isoformat(),
                }
            ).eq("id", payment_id).execute()

            logger.debug(
                "Payment refund updated in database",
                payment_id=payment_id,
                refund_id=refund_id,
            )

        except Exception as e:
            logger.error(
                "Failed to update payment refund in database",
                payment_id=payment_id,
                error=str(e),
            )
