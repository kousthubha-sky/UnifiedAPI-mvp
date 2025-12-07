"""Tests for authentication middleware."""

import pytest
from fastapi.testclient import TestClient

from app.auth import (
    AuthContext,
    _get_route_key,
    is_bootstrap_allowed_route,
    is_public_route,
)
from app.config import Settings
from app.main import app


@pytest.fixture
def client() -> TestClient:
    """Create a test client for the FastAPI application."""
    return TestClient(app, raise_server_exceptions=False)


class TestPublicRoutes:
    """Test suite for public route detection."""

    def test_health_is_public(self) -> None:
        """Health endpoint should be public."""
        assert is_public_route("GET", "/health")

    def test_docs_is_public(self) -> None:
        """Docs endpoint should be public."""
        assert is_public_route("GET", "/docs")

    def test_root_is_public(self) -> None:
        """Root endpoint should be public."""
        assert is_public_route("GET", "/")

    def test_customer_creation_is_public(self) -> None:
        """POST /api/v1/customers should be public."""
        assert is_public_route("POST", "/api/v1/customers")

    def test_options_is_always_public(self) -> None:
        """OPTIONS requests should always be public (CORS preflight)."""
        assert is_public_route("OPTIONS", "/api/v1/payments")
        assert is_public_route("OPTIONS", "/health")
        assert is_public_route("OPTIONS", "/anything")

    def test_protected_route_not_public(self) -> None:
        """Protected routes should not be public."""
        assert not is_public_route("GET", "/api/v1/payments")
        assert not is_public_route("POST", "/api/v1/payments")


class TestBootstrapRoutes:
    """Test suite for bootstrap key allowed routes."""

    def test_api_keys_post_allows_bootstrap(self) -> None:
        """POST /api/v1/api-keys should allow bootstrap key."""
        assert is_bootstrap_allowed_route("POST", "/api/v1/api-keys")

    def test_other_routes_dont_allow_bootstrap(self) -> None:
        """Other routes should not allow bootstrap key."""
        assert not is_bootstrap_allowed_route("GET", "/api/v1/api-keys")
        assert not is_bootstrap_allowed_route("GET", "/api/v1/payments")
        assert not is_bootstrap_allowed_route("POST", "/api/v1/payments")


class TestAuthMiddleware:
    """Test suite for authentication middleware."""

    def test_public_route_no_api_key_required(self, client: TestClient) -> None:
        """Public routes should not require API key."""
        response = client.get("/health")
        assert response.status_code == 200

    def test_missing_api_key_returns_401(self, client: TestClient) -> None:
        """Protected routes without API key should return 401."""
        response = client.get("/api/v1/payments")
        assert response.status_code == 401

        data = response.json()
        assert data["code"] == "MISSING_API_KEY"
        assert "error" in data

    def test_error_response_includes_trace_id(self, client: TestClient) -> None:
        """Error responses should include trace ID."""
        response = client.get("/api/v1/payments")
        assert response.status_code == 401

        # Check header
        assert "X-Trace-Id" in response.headers

        # Check body
        data = response.json()
        assert "trace_id" in data


class TestStaticAPIKeys:
    """Test suite for static allowed API keys."""

    def test_static_api_keys_setting_type(self) -> None:
        """Static API keys setting should be a list."""

        # Test the validator with a comma-separated string
        keys = Settings.parse_allowed_api_keys("key1,key2,key3")
        assert keys == ["key1", "key2", "key3"]

    def test_empty_api_keys_returns_empty_list(self) -> None:
        """Empty API keys setting should return empty list."""

        keys = Settings.parse_allowed_api_keys(None)
        assert keys == []

    def test_api_keys_list_passthrough(self) -> None:
        """List of API keys should pass through unchanged."""

        keys = Settings.parse_allowed_api_keys(["key1", "key2"])
        assert keys == ["key1", "key2"]


class TestBootstrapAPIKey:
    """Test suite for bootstrap API key logic."""

    def test_bootstrap_route_detection(self) -> None:
        """POST /api/v1/api-keys should be detected as bootstrap-allowed."""
        assert is_bootstrap_allowed_route("POST", "/api/v1/api-keys")

    def test_non_bootstrap_route_detection(self) -> None:
        """Other routes should not be detected as bootstrap-allowed."""
        assert not is_bootstrap_allowed_route("GET", "/api/v1/api-keys")
        assert not is_bootstrap_allowed_route("GET", "/api/v1/payments")


class TestAuthContext:
    """Test suite for AuthContext dataclass."""

    def test_auth_context_defaults(self) -> None:
        """AuthContext should have sensible defaults."""
        ctx = AuthContext(customer_id="cust-123", tier="starter")
        assert ctx.customer_id == "cust-123"
        assert ctx.tier == "starter"
        assert ctx.api_key_id is None
        assert ctx.is_bootstrap is False
        assert ctx.is_static_key is False

    def test_auth_context_bootstrap(self) -> None:
        """AuthContext can represent bootstrap authentication."""
        ctx = AuthContext(
            customer_id=None,
            tier="admin",
            is_bootstrap=True,
        )
        assert ctx.customer_id is None
        assert ctx.tier == "admin"
        assert ctx.is_bootstrap is True

    def test_auth_context_static_key(self) -> None:
        """AuthContext can represent static key authentication."""
        ctx = AuthContext(
            customer_id=None,
            tier="admin",
            is_static_key=True,
        )
        assert ctx.customer_id is None
        assert ctx.tier == "admin"
        assert ctx.is_static_key is True


class TestRouteKeyNormalization:
    """Test suite for route key normalization."""

    def test_trailing_slash_normalized(self) -> None:
        """Trailing slashes should be normalized."""
        assert _get_route_key("GET", "/health/") == ("GET", "/health")
        assert _get_route_key("GET", "/health") == ("GET", "/health")

    def test_root_path_preserved(self) -> None:
        """Root path should be preserved."""
        assert _get_route_key("GET", "/") == ("GET", "/")

    def test_method_uppercase(self) -> None:
        """Methods should be uppercased."""
        assert _get_route_key("get", "/health") == ("GET", "/health")
        assert _get_route_key("post", "/api/v1/payments") == ("POST", "/api/v1/payments")
