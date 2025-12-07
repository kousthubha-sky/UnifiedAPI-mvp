"""Tests for health check endpoint and application startup."""

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client() -> TestClient:
    """Create a test client for the FastAPI application."""
    return TestClient(app, raise_server_exceptions=False)


class TestHealthEndpoint:
    """Test suite for /health endpoint."""

    def test_health_returns_ok(self, client: TestClient) -> None:
        """Health check should return status ok."""
        response = client.get("/health")
        assert response.status_code == 200

        data = response.json()
        assert data["status"] == "ok"
        assert "timestamp" in data

    def test_health_timestamp_format(self, client: TestClient) -> None:
        """Health check timestamp should be ISO format."""
        response = client.get("/health")
        data = response.json()

        # Should be valid ISO format
        from datetime import datetime

        timestamp = data["timestamp"]
        # Will raise if invalid format
        datetime.fromisoformat(timestamp.replace("Z", "+00:00"))

    def test_health_includes_trace_id_header(self, client: TestClient) -> None:
        """Response should include X-Trace-Id header."""
        response = client.get("/health")
        assert "X-Trace-Id" in response.headers

    def test_health_uses_provided_trace_id(self, client: TestClient) -> None:
        """Response should echo provided trace ID."""
        trace_id = "test-trace-123"
        response = client.get("/health", headers={"X-Trace-Id": trace_id})
        assert response.headers.get("X-Trace-Id") == trace_id


class TestRootEndpoint:
    """Test suite for root endpoint."""

    def test_root_returns_api_info(self, client: TestClient) -> None:
        """Root should return API information."""
        response = client.get("/")
        assert response.status_code == 200

        data = response.json()
        assert data["name"] == "Unified Payment API"
        assert "version" in data
        assert data["docs"] == "/docs"
        assert data["health"] == "/health"


class TestOpenAPISchema:
    """Test suite for OpenAPI documentation."""

    def test_openapi_schema_available(self, client: TestClient) -> None:
        """OpenAPI schema should be accessible."""
        response = client.get("/openapi.json")
        assert response.status_code == 200

        data = response.json()
        assert data["info"]["title"] == "Unified Payment API"
        assert "paths" in data
        assert "/health" in data["paths"]

    def test_docs_available(self, client: TestClient) -> None:
        """Swagger UI should be accessible."""
        response = client.get("/docs")
        assert response.status_code == 200
        assert "text/html" in response.headers["content-type"]

    def test_redoc_available(self, client: TestClient) -> None:
        """ReDoc should be accessible."""
        response = client.get("/redoc")
        assert response.status_code == 200
        assert "text/html" in response.headers["content-type"]


class TestCORS:
    """Test suite for CORS configuration."""

    def test_cors_headers_present(self, client: TestClient) -> None:
        """CORS headers should be present in responses."""
        response = client.options(
            "/health",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
            },
        )
        # Preflight requests are handled by middleware
        assert response.status_code in (200, 204)
