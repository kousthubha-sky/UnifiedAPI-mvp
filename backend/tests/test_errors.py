"""Tests for error response handling."""

import pytest
from fastapi.testclient import TestClient

from app.errors import (
    APIError,
    BootstrapKeyNotAllowedError,
    ErrorCode,
    ErrorResponse,
    ForbiddenError,
    InternalError,
    InvalidAPIKeyError,
    MissingAPIKeyError,
    NotFoundError,
    RateLimitExceededError,
    UnauthorizedError,
    ValidationError,
    create_error_response,
)
from app.main import app


@pytest.fixture
def client() -> TestClient:
    """Create a test client for the FastAPI application."""
    return TestClient(app, raise_server_exceptions=False)


class TestErrorCode:
    """Test suite for ErrorCode enum."""

    def test_missing_api_key_code(self) -> None:
        """MISSING_API_KEY code should be correct."""
        assert ErrorCode.MISSING_API_KEY.value == "MISSING_API_KEY"

    def test_invalid_api_key_code(self) -> None:
        """INVALID_API_KEY code should be correct."""
        assert ErrorCode.INVALID_API_KEY.value == "INVALID_API_KEY"

    def test_rate_limit_exceeded_code(self) -> None:
        """RATE_LIMIT_EXCEEDED code should be correct."""
        assert ErrorCode.RATE_LIMIT_EXCEEDED.value == "RATE_LIMIT_EXCEEDED"

    def test_unauthorized_code(self) -> None:
        """UNAUTHORIZED code should be correct."""
        assert ErrorCode.UNAUTHORIZED.value == "UNAUTHORIZED"


class TestErrorResponse:
    """Test suite for ErrorResponse model."""

    def test_basic_error_response(self) -> None:
        """ErrorResponse should serialize correctly."""
        response = ErrorResponse(
            code="TEST_ERROR",
            error="Test error message",
        )
        data = response.model_dump()
        assert data["code"] == "TEST_ERROR"
        assert data["error"] == "Test error message"

    def test_error_response_with_details(self) -> None:
        """ErrorResponse should include details when provided."""
        response = ErrorResponse(
            code="TEST_ERROR",
            error="Test error message",
            details={"field": "value"},
        )
        data = response.model_dump()
        assert data["details"] == {"field": "value"}

    def test_error_response_with_trace_id(self) -> None:
        """ErrorResponse should include trace_id when provided."""
        response = ErrorResponse(
            code="TEST_ERROR",
            error="Test error message",
            trace_id="trace-123",
        )
        data = response.model_dump()
        assert data["trace_id"] == "trace-123"


class TestAPIError:
    """Test suite for base APIError class."""

    def test_api_error_attributes(self) -> None:
        """APIError should have correct attributes."""
        error = APIError(
            code=ErrorCode.INTERNAL_ERROR,
            message="Something went wrong",
            status_code=500,
            details={"context": "test"},
        )
        assert error.code == "INTERNAL_ERROR"
        assert error.message == "Something went wrong"
        assert error.status_code == 500
        assert error.details == {"context": "test"}

    def test_api_error_to_response(self) -> None:
        """APIError should convert to ErrorResponse."""
        error = APIError(
            code=ErrorCode.VALIDATION_ERROR,
            message="Invalid input",
            status_code=400,
        )
        response = error.to_response(trace_id="trace-456")
        assert response.code == "VALIDATION_ERROR"
        assert response.error == "Invalid input"
        assert response.trace_id == "trace-456"


class TestSpecificErrors:
    """Test suite for specific error classes."""

    def test_missing_api_key_error(self) -> None:
        """MissingAPIKeyError should have correct defaults."""
        error = MissingAPIKeyError()
        assert error.code == "MISSING_API_KEY"
        assert error.status_code == 401
        assert "API key is required" in error.message

    def test_invalid_api_key_error(self) -> None:
        """InvalidAPIKeyError should have correct defaults."""
        error = InvalidAPIKeyError()
        assert error.code == "INVALID_API_KEY"
        assert error.status_code == 401
        assert "Invalid" in error.message

    def test_unauthorized_error(self) -> None:
        """UnauthorizedError should have correct defaults."""
        error = UnauthorizedError()
        assert error.code == "UNAUTHORIZED"
        assert error.status_code == 401

    def test_unauthorized_error_custom_message(self) -> None:
        """UnauthorizedError should accept custom message."""
        error = UnauthorizedError(message="Custom unauthorized message")
        assert error.message == "Custom unauthorized message"

    def test_forbidden_error(self) -> None:
        """ForbiddenError should have correct defaults."""
        error = ForbiddenError()
        assert error.code == "FORBIDDEN"
        assert error.status_code == 403

    def test_bootstrap_key_not_allowed_error(self) -> None:
        """BootstrapKeyNotAllowedError should have correct defaults."""
        error = BootstrapKeyNotAllowedError()
        assert error.code == "BOOTSTRAP_KEY_NOT_ALLOWED"
        assert error.status_code == 403
        assert "Bootstrap" in error.message

    def test_rate_limit_exceeded_error(self) -> None:
        """RateLimitExceededError should have correct attributes."""
        error = RateLimitExceededError(
            limit=100,
            remaining=0,
            reset_at=1234567890,
        )
        assert error.code == "RATE_LIMIT_EXCEEDED"
        assert error.status_code == 429
        assert error.limit == 100
        assert error.remaining == 0
        assert error.reset_at == 1234567890
        assert error.details["limit"] == 100

    def test_not_found_error(self) -> None:
        """NotFoundError should have correct defaults."""
        error = NotFoundError()
        assert error.code == "NOT_FOUND"
        assert error.status_code == 404

    def test_not_found_error_custom(self) -> None:
        """NotFoundError should accept custom message and code."""
        error = NotFoundError(
            message="Payment not found",
            code=ErrorCode.PAYMENT_NOT_FOUND,
        )
        assert error.code == "PAYMENT_NOT_FOUND"
        assert error.message == "Payment not found"

    def test_validation_error(self) -> None:
        """ValidationError should have correct defaults."""
        error = ValidationError()
        assert error.code == "VALIDATION_ERROR"
        assert error.status_code == 400

    def test_validation_error_with_details(self) -> None:
        """ValidationError should include field details."""
        error = ValidationError(
            message="Invalid amount",
            details={"field": "amount", "reason": "must be positive"},
        )
        assert error.details["field"] == "amount"

    def test_internal_error(self) -> None:
        """InternalError should have correct defaults."""
        error = InternalError()
        assert error.code == "INTERNAL_ERROR"
        assert error.status_code == 500


class TestCreateErrorResponse:
    """Test suite for create_error_response function."""

    def test_creates_orjson_response(self) -> None:
        """create_error_response should return ORJSONResponse."""
        from fastapi.responses import ORJSONResponse

        response = create_error_response(
            code=ErrorCode.NOT_FOUND,
            message="Resource not found",
            status_code=404,
        )
        assert isinstance(response, ORJSONResponse)
        assert response.status_code == 404

    def test_response_body_format(self) -> None:
        """create_error_response body should match expected format."""
        response = create_error_response(
            code="TEST_ERROR",
            message="Test message",
            status_code=400,
            details={"extra": "info"},
            trace_id="trace-789",
        )

        # Decode and parse body
        import json

        body = json.loads(response.body.decode())
        assert body["code"] == "TEST_ERROR"
        assert body["error"] == "Test message"
        assert body["details"] == {"extra": "info"}
        assert body["trace_id"] == "trace-789"


class TestErrorResponseContract:
    """Test suite for error response contract compliance."""

    def test_401_response_format(self, client: TestClient) -> None:
        """401 responses should follow the expected contract."""
        response = client.get("/api/v1/payments")
        assert response.status_code == 401

        data = response.json()
        # Required fields from contract
        assert "code" in data
        assert "error" in data
        # Optional fields
        assert "trace_id" in data

    def test_error_response_has_code_field(self, client: TestClient) -> None:
        """Error responses must have 'code' field."""
        response = client.get("/api/v1/payments")
        data = response.json()
        assert isinstance(data.get("code"), str)
        assert len(data["code"]) > 0

    def test_error_response_has_error_field(self, client: TestClient) -> None:
        """Error responses must have 'error' field (message)."""
        response = client.get("/api/v1/payments")
        data = response.json()
        assert isinstance(data.get("error"), str)
        assert len(data["error"]) > 0
