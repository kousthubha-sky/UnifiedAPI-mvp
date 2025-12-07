"""Tests for payment service and routes."""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.payments.errors import (
    InvalidProviderError,
    PaymentFailedError,
    PaymentNotFoundError,
    ProviderError,
    RefundFailedError,
)
from app.payments.providers.base import (
    ProviderPaymentResult,
    ProviderRefundResult,
    ProviderStatusResult,
)
from app.payments.service import PaymentService
from app.payments.types import (
    CreatePaymentRequest,
    ListPaymentsRequest,
    PaymentProvider,
    PaymentStatus,
    RefundPaymentRequest,
)


@pytest.fixture
def client() -> TestClient:
    """Create a test client for the FastAPI application."""
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def mock_settings() -> MagicMock:
    """Create mock settings."""
    settings = MagicMock()
    settings.stripe_api_key = "sk_test_123"
    settings.paypal_client_id = "test_client_id"
    settings.paypal_client_secret = "test_client_secret"
    settings.paypal_mode = "sandbox"
    settings.paypal_currency = "USD"
    return settings


@pytest.fixture
def mock_supabase() -> MagicMock:
    """Create mock Supabase client."""
    supabase = MagicMock()
    # Mock table operations
    table_mock = MagicMock()
    table_mock.insert.return_value.execute.return_value = MagicMock(data=[{"id": "test-id"}])
    table_mock.select.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[
            {
                "id": "test-payment-id",
                "provider": "stripe",
                "provider_transaction_id": "pi_test123",
                "amount": 1000,
                "currency": "USD",
                "status": "completed",
                "customer_id": "cust_123",
                "metadata": None,
                "refund_id": None,
                "refund_status": None,
                "refund_amount": None,
                "created_at": "2024-01-01T00:00:00Z",
                "updated_at": "2024-01-01T00:00:00Z",
            }
        ],
        count=1,
    )
    supabase.table.return_value = table_mock
    return supabase


@pytest.fixture
def mock_redis() -> AsyncMock:
    """Create mock Redis client."""
    redis = AsyncMock()
    redis.get.return_value = None
    redis.set.return_value = True
    return redis


class TestPaymentService:
    """Test suite for PaymentService."""

    @pytest.mark.asyncio
    async def test_create_payment_stripe_success(
        self,
        mock_settings: MagicMock,
        mock_supabase: MagicMock,
        mock_redis: AsyncMock,
    ) -> None:
        """Test successful Stripe payment creation."""
        service = PaymentService(
            settings=mock_settings,
            supabase=mock_supabase,
            redis=mock_redis,
        )

        # Mock the Stripe adapter
        mock_result = ProviderPaymentResult(
            provider_transaction_id="pi_test123",
            status=PaymentStatus.COMPLETED,
            client_secret="pi_test123_secret_xyz",
            provider_metadata={"stripe_status": "succeeded"},
        )

        with patch.object(service, "_get_adapter") as mock_adapter:
            adapter_instance = AsyncMock()
            adapter_instance.create_payment.return_value = mock_result
            mock_adapter.return_value = adapter_instance

            request = CreatePaymentRequest(
                amount=1000,
                currency="USD",
                provider=PaymentProvider.STRIPE,
                customer_id="cust_123",
                payment_method="pm_card_visa",
                description="Test payment",
            )

            response = await service.create_payment(request)

            assert response.provider_transaction_id == "pi_test123"
            assert response.status == PaymentStatus.COMPLETED
            assert response.amount == 1000
            assert response.currency == "USD"
            assert response.client_secret == "pi_test123_secret_xyz"
            assert response.trace_id is not None

    @pytest.mark.asyncio
    async def test_create_payment_with_idempotency_cache_hit(
        self,
        mock_settings: MagicMock,
        mock_supabase: MagicMock,
        mock_redis: AsyncMock,
    ) -> None:
        """Test idempotency cache returns cached response."""
        cached_response = {
            "id": "cached-payment-id",
            "provider_transaction_id": "pi_cached",
            "amount": 1000,
            "currency": "USD",
            "status": "completed",
            "created_at": "2024-01-01T00:00:00Z",
            "trace_id": "cached-trace-id",
        }

        import json

        mock_redis.get.return_value = json.dumps(cached_response)

        service = PaymentService(
            settings=mock_settings,
            supabase=mock_supabase,
            redis=mock_redis,
        )

        request = CreatePaymentRequest(
            amount=1000,
            currency="USD",
            provider=PaymentProvider.STRIPE,
            customer_id="cust_123",
            payment_method="pm_card_visa",
        )

        response = await service.create_payment(
            request=request,
            idempotency_key="test-idempotency-key",
        )

        # Should return cached response
        assert response.id == "cached-payment-id"
        assert response.provider_transaction_id == "pi_cached"

    @pytest.mark.asyncio
    async def test_refund_payment_success(
        self,
        mock_settings: MagicMock,
        mock_supabase: MagicMock,
        mock_redis: AsyncMock,
    ) -> None:
        """Test successful payment refund."""
        service = PaymentService(
            settings=mock_settings,
            supabase=mock_supabase,
            redis=mock_redis,
        )

        mock_result = ProviderRefundResult(
            refund_id="re_test123",
            status=PaymentStatus.REFUNDED,
            amount=1000,
            provider_metadata={"stripe_status": "succeeded"},
        )

        with patch.object(service, "_get_adapter") as mock_adapter:
            adapter_instance = AsyncMock()
            adapter_instance.refund_payment.return_value = mock_result
            mock_adapter.return_value = adapter_instance

            request = RefundPaymentRequest(reason="Customer request")

            response = await service.refund_payment(
                payment_id="test-payment-id",
                request=request,
            )

            assert response.refund_id == "re_test123"
            assert response.status == PaymentStatus.REFUNDED
            assert response.amount == 1000

    @pytest.mark.asyncio
    async def test_list_payments_success(
        self,
        mock_settings: MagicMock,
        mock_supabase: MagicMock,
        mock_redis: AsyncMock,
    ) -> None:
        """Test listing payments."""
        # Configure supabase mock for list operation
        table_mock = MagicMock()
        select_mock = MagicMock()
        select_mock.order.return_value.range.return_value.execute.return_value = MagicMock(
            data=[
                {
                    "id": "pay_1",
                    "provider_transaction_id": "pi_1",
                    "provider": "stripe",
                    "amount": 1000,
                    "currency": "USD",
                    "status": "completed",
                    "customer_id": "cust_1",
                    "metadata": None,
                    "refund_id": None,
                    "refund_status": None,
                    "refund_amount": None,
                    "created_at": "2024-01-01T00:00:00Z",
                    "updated_at": "2024-01-01T00:00:00Z",
                },
            ],
            count=1,
        )
        table_mock.select.return_value = select_mock
        mock_supabase.table.return_value = table_mock

        service = PaymentService(
            settings=mock_settings,
            supabase=mock_supabase,
            redis=mock_redis,
        )

        request = ListPaymentsRequest(limit=10, offset=0)
        response = await service.list_payments(request)

        assert len(response.payments) == 1
        assert response.total == 1
        assert response.payments[0].id == "pay_1"


class TestPaymentErrors:
    """Test suite for payment error classes."""

    def test_payment_failed_error(self) -> None:
        """Test PaymentFailedError attributes."""
        error = PaymentFailedError(
            message="Card declined",
            details={"code": "card_declined"},
        )
        assert error.code == "PAYMENT_FAILED"
        assert error.status_code == 400
        assert error.message == "Card declined"
        assert error.details == {"code": "card_declined"}

    def test_refund_failed_error(self) -> None:
        """Test RefundFailedError attributes."""
        error = RefundFailedError(
            message="Refund not available",
            details={"reason": "payment_not_captured"},
        )
        assert error.code == "REFUND_FAILED"
        assert error.status_code == 400

    def test_provider_error(self) -> None:
        """Test ProviderError attributes."""
        error = ProviderError(
            provider="stripe",
            message="API rate limited",
        )
        assert error.code == "PROVIDER_ERROR"
        assert error.status_code == 502
        assert error.details["provider"] == "stripe"

    def test_payment_not_found_error(self) -> None:
        """Test PaymentNotFoundError attributes."""
        error = PaymentNotFoundError(payment_id="pay_123")
        assert error.code == "PAYMENT_NOT_FOUND"
        assert error.status_code == 404
        assert "pay_123" in error.message
        assert error.details["payment_id"] == "pay_123"

    def test_invalid_provider_error(self) -> None:
        """Test InvalidProviderError attributes."""
        error = InvalidProviderError(provider="invalid_provider")
        assert error.code == "INVALID_PROVIDER"
        assert error.status_code == 400
        assert "invalid_provider" in error.message


class TestPaymentRoutes:
    """Test suite for payment API routes."""

    def test_create_payment_requires_auth(self, client: TestClient) -> None:
        """Test create payment requires authentication."""
        response = client.post(
            "/api/v1/payments/create",
            json={
                "amount": 1000,
                "currency": "USD",
                "provider": "stripe",
                "customer_id": "cust_123",
                "payment_method": "pm_card_visa",
            },
        )
        # Should require API key
        assert response.status_code == 401
        data = response.json()
        assert data["code"] == "MISSING_API_KEY"

    def test_list_payments_requires_auth(self, client: TestClient) -> None:
        """Test list payments requires authentication."""
        response = client.get("/api/v1/payments")
        assert response.status_code == 401

    def test_refund_payment_requires_auth(self, client: TestClient) -> None:
        """Test refund payment requires authentication."""
        response = client.post(
            "/api/v1/payments/pay_123/refund",
            json={},
        )
        assert response.status_code == 401

    def test_payment_status_requires_auth(self, client: TestClient) -> None:
        """Test payment status requires authentication."""
        response = client.get("/api/v1/payments/pay_123")
        assert response.status_code == 401


class TestPaymentTypes:
    """Test suite for payment type validation."""

    def test_create_payment_request_valid(self) -> None:
        """Test valid CreatePaymentRequest."""
        request = CreatePaymentRequest(
            amount=1000,
            currency="USD",
            provider=PaymentProvider.STRIPE,
            customer_id="cust_123",
            payment_method="pm_card_visa",
            description="Test payment",
            metadata={"order_id": "order_123"},
        )
        assert request.amount == 1000
        assert request.currency == "USD"
        assert request.provider == PaymentProvider.STRIPE

    def test_create_payment_request_invalid_amount(self) -> None:
        """Test CreatePaymentRequest with invalid amount."""
        with pytest.raises(ValueError):
            CreatePaymentRequest(
                amount=0,  # Invalid: must be > 0
                currency="USD",
                provider=PaymentProvider.STRIPE,
                customer_id="cust_123",
                payment_method="pm_card_visa",
            )

    def test_create_payment_request_invalid_currency(self) -> None:
        """Test CreatePaymentRequest with invalid currency."""
        with pytest.raises(ValueError):
            CreatePaymentRequest(
                amount=1000,
                currency="US",  # Invalid: must be 3 chars
                provider=PaymentProvider.STRIPE,
                customer_id="cust_123",
                payment_method="pm_card_visa",
            )

    def test_refund_request_valid(self) -> None:
        """Test valid RefundPaymentRequest."""
        request = RefundPaymentRequest(
            amount=500,
            reason="Customer request",
        )
        assert request.amount == 500
        assert request.reason == "Customer request"

    def test_refund_request_full_refund(self) -> None:
        """Test RefundPaymentRequest for full refund."""
        request = RefundPaymentRequest()
        assert request.amount is None
        assert request.reason is None

    def test_list_payments_request_defaults(self) -> None:
        """Test ListPaymentsRequest defaults."""
        request = ListPaymentsRequest()
        assert request.limit == 10
        assert request.offset == 0
        assert request.provider is None
        assert request.status is None

    def test_list_payments_request_with_filters(self) -> None:
        """Test ListPaymentsRequest with filters."""
        request = ListPaymentsRequest(
            provider=PaymentProvider.STRIPE,
            status=PaymentStatus.COMPLETED,
            customer_id="cust_123",
            limit=50,
            offset=10,
        )
        assert request.provider == PaymentProvider.STRIPE
        assert request.status == PaymentStatus.COMPLETED
        assert request.limit == 50
        assert request.offset == 10


class TestProviderStatusMapping:
    """Test payment status mapping from providers."""

    def test_payment_status_values(self) -> None:
        """Test PaymentStatus enum values."""
        assert PaymentStatus.PENDING.value == "pending"
        assert PaymentStatus.COMPLETED.value == "completed"
        assert PaymentStatus.FAILED.value == "failed"
        assert PaymentStatus.REFUNDED.value == "refunded"
        assert PaymentStatus.PROCESSING.value == "processing"

    def test_payment_provider_values(self) -> None:
        """Test PaymentProvider enum values."""
        assert PaymentProvider.STRIPE.value == "stripe"
        assert PaymentProvider.PAYPAL.value == "paypal"
