"""Tests for rate limiting middleware."""

from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from app.auth import AuthContext
from app.main import app
from app.rate_limiting import (
    TIER_LIMITS,
    RateLimitInfo,
    _get_identifier,
    _get_rate_limit_key,
    _get_tier_limit,
    add_rate_limit_headers,
    check_rate_limit,
    is_rate_limit_exempt,
)


@pytest.fixture
def client() -> TestClient:
    """Create a test client for the FastAPI application."""
    return TestClient(app, raise_server_exceptions=False)


class TestTierLimits:
    """Test suite for tier-based rate limits."""

    def test_starter_tier_limit(self) -> None:
        """Starter tier should have 100 requests/minute."""
        assert TIER_LIMITS["starter"] == 100

    def test_growth_tier_limit(self) -> None:
        """Growth tier should have 500 requests/minute."""
        assert TIER_LIMITS["growth"] == 500

    def test_scale_tier_limit(self) -> None:
        """Scale tier should have 2000 requests/minute."""
        assert TIER_LIMITS["scale"] == 2000

    def test_admin_tier_limit(self) -> None:
        """Admin tier should have high limit."""
        assert TIER_LIMITS["admin"] == 10000

    def test_public_tier_limit(self) -> None:
        """Public tier should have 60 requests/minute."""
        assert TIER_LIMITS["public"] == 60


class TestRateLimitExemptions:
    """Test suite for rate limit exemptions."""

    def test_health_exempt(self) -> None:
        """Health endpoint should be exempt."""
        assert is_rate_limit_exempt("GET", "/health")

    def test_docs_exempt(self) -> None:
        """Docs endpoint should be exempt."""
        assert is_rate_limit_exempt("GET", "/docs")

    def test_root_exempt(self) -> None:
        """Root endpoint should be exempt."""
        assert is_rate_limit_exempt("GET", "/")

    def test_customer_creation_exempt(self) -> None:
        """POST /api/v1/customers should be exempt."""
        assert is_rate_limit_exempt("POST", "/api/v1/customers")

    def test_payments_not_exempt(self) -> None:
        """Payments endpoints should not be exempt."""
        assert not is_rate_limit_exempt("GET", "/api/v1/payments")
        assert not is_rate_limit_exempt("POST", "/api/v1/payments")


class TestIdentifierGeneration:
    """Test suite for rate limit identifier generation."""

    def test_customer_id_used_when_authenticated(self) -> None:
        """Customer ID should be used for authenticated requests."""
        request = MagicMock()
        request.headers = {}
        request.client = MagicMock()
        request.client.host = "127.0.0.1"

        auth_ctx = AuthContext(customer_id="cust-123", tier="starter")
        identifier = _get_identifier(request, auth_ctx)

        assert identifier == "customer:cust-123"

    def test_ip_used_when_not_authenticated(self) -> None:
        """Client IP should be used for unauthenticated requests."""
        request = MagicMock()
        request.headers = {}
        request.client = MagicMock()
        request.client.host = "192.168.1.1"

        identifier = _get_identifier(request, None)

        assert identifier == "ip:192.168.1.1"

    def test_forwarded_for_header_used(self) -> None:
        """X-Forwarded-For header should be preferred."""
        request = MagicMock()
        request.headers = {"X-Forwarded-For": "10.0.0.1, 192.168.1.1"}
        request.client = MagicMock()
        request.client.host = "127.0.0.1"

        identifier = _get_identifier(request, None)

        assert identifier == "ip:10.0.0.1"


class TestTierLimitSelection:
    """Test suite for tier limit selection."""

    def test_starter_tier(self) -> None:
        """Starter tier should return starter limit."""
        auth_ctx = AuthContext(customer_id="cust-123", tier="starter")
        limit = _get_tier_limit(auth_ctx)
        assert limit == TIER_LIMITS["starter"]

    def test_growth_tier(self) -> None:
        """Growth tier should return growth limit."""
        auth_ctx = AuthContext(customer_id="cust-123", tier="growth")
        limit = _get_tier_limit(auth_ctx)
        assert limit == TIER_LIMITS["growth"]

    def test_scale_tier(self) -> None:
        """Scale tier should return scale limit."""
        auth_ctx = AuthContext(customer_id="cust-123", tier="scale")
        limit = _get_tier_limit(auth_ctx)
        assert limit == TIER_LIMITS["scale"]

    def test_admin_tier(self) -> None:
        """Admin tier should return admin limit."""
        auth_ctx = AuthContext(customer_id="cust-123", tier="admin")
        limit = _get_tier_limit(auth_ctx)
        assert limit == TIER_LIMITS["admin"]

    def test_unknown_tier_defaults_to_starter(self) -> None:
        """Unknown tier should default to starter limit."""
        auth_ctx = AuthContext(customer_id="cust-123", tier="unknown")
        limit = _get_tier_limit(auth_ctx)
        assert limit == TIER_LIMITS["starter"]

    def test_none_auth_returns_public_limit(self) -> None:
        """No auth context should return public limit."""
        limit = _get_tier_limit(None)
        assert limit == TIER_LIMITS["public"]


class TestRateLimitInfo:
    """Test suite for RateLimitInfo dataclass."""

    def test_rate_limit_info_creation(self) -> None:
        """RateLimitInfo should store all fields correctly."""
        info = RateLimitInfo(
            limit=100,
            remaining=50,
            reset_at=1234567890,
            is_exceeded=False,
        )
        assert info.limit == 100
        assert info.remaining == 50
        assert info.reset_at == 1234567890
        assert info.is_exceeded is False

    def test_rate_limit_exceeded(self) -> None:
        """RateLimitInfo should indicate exceeded state."""
        info = RateLimitInfo(
            limit=100,
            remaining=0,
            reset_at=1234567890,
            is_exceeded=True,
        )
        assert info.is_exceeded is True


class TestRateLimitHeaders:
    """Test suite for rate limit header injection."""

    def test_headers_added_to_response(self) -> None:
        """Rate limit headers should be added to response."""
        from fastapi import Response

        response = Response()
        info = RateLimitInfo(
            limit=100,
            remaining=50,
            reset_at=1234567890,
            is_exceeded=False,
        )

        add_rate_limit_headers(response, info)

        assert response.headers["X-RateLimit-Limit"] == "100"
        assert response.headers["X-RateLimit-Remaining"] == "50"
        assert response.headers["X-RateLimit-Reset"] == "1234567890"


class TestRateLimitMiddleware:
    """Test suite for rate limiting middleware integration."""

    def test_public_routes_have_no_rate_limit_headers(self, client: TestClient) -> None:
        """Public routes should not have rate limit headers."""
        response = client.get("/health")
        assert response.status_code == 200
        # Public routes are exempt, so no rate limit headers
        assert "X-RateLimit-Limit" not in response.headers

    def test_protected_route_without_key_returns_401_not_429(self, client: TestClient) -> None:
        """Protected routes without API key should return 401, not 429."""
        response = client.get("/api/v1/payments")
        assert response.status_code == 401
        data = response.json()
        assert data["code"] == "MISSING_API_KEY"


@pytest.mark.asyncio
class TestCheckRateLimit:
    """Test suite for check_rate_limit function."""

    async def test_allows_request_when_redis_unavailable(self) -> None:
        """Requests should be allowed when Redis is unavailable."""
        info = await check_rate_limit(None, "test-identifier", 100)

        assert info.is_exceeded is False
        assert info.remaining == 100

    async def test_handles_redis_error_gracefully(self) -> None:
        """Should allow request on Redis error."""
        mock_redis = AsyncMock()
        mock_redis.pipeline.side_effect = Exception("Redis connection failed")

        info = await check_rate_limit(mock_redis, "test-identifier", 100)

        assert info.is_exceeded is False
        assert info.remaining == 100

    async def test_redis_integration_behavior(self) -> None:
        """Test the expected behavior of rate limit check."""
        # When Redis is None, should always allow
        info = await check_rate_limit(None, "customer:123", 100)

        assert info.limit == 100
        assert info.is_exceeded is False
        # remaining should be the full limit when Redis unavailable
        assert info.remaining == 100


class TestRateLimitKeyGeneration:
    """Test suite for rate limit key generation."""

    def test_key_format(self) -> None:
        """Rate limit key should have correct format."""
        key = _get_rate_limit_key("customer:cust-123")
        assert key == "ratelimit:customer:cust-123"

    def test_key_with_ip(self) -> None:
        """Rate limit key should work with IP identifiers."""
        key = _get_rate_limit_key("ip:192.168.1.1")
        assert key == "ratelimit:ip:192.168.1.1"
