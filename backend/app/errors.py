"""Centralized error responses for the API.

Provides standardized error response format matching the Fastify contract:
- code: Error code string (e.g., MISSING_API_KEY, RATE_LIMIT_EXCEEDED)
- error: Human-readable error message
- details: Optional additional context
- trace_id: Request trace ID for debugging
"""

from __future__ import annotations

from enum import Enum
from typing import Any

from fastapi import Request
from fastapi.responses import ORJSONResponse
from pydantic import BaseModel

from app.logging import get_trace_id


class ErrorCode(str, Enum):
    """Standard error codes matching SDK expectations."""

    # Authentication errors
    MISSING_API_KEY = "MISSING_API_KEY"
    INVALID_API_KEY = "INVALID_API_KEY"
    UNAUTHORIZED = "UNAUTHORIZED"
    FORBIDDEN = "FORBIDDEN"
    BOOTSTRAP_KEY_NOT_ALLOWED = "BOOTSTRAP_KEY_NOT_ALLOWED"

    # Rate limiting
    RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED"

    # Validation errors
    VALIDATION_ERROR = "VALIDATION_ERROR"
    INVALID_PROVIDER = "INVALID_PROVIDER"

    # Resource errors
    NOT_FOUND = "NOT_FOUND"
    PAYMENT_NOT_FOUND = "PAYMENT_NOT_FOUND"
    CUSTOMER_NOT_FOUND = "CUSTOMER_NOT_FOUND"
    API_KEY_NOT_FOUND = "API_KEY_NOT_FOUND"

    # Conflict errors
    CUSTOMER_EXISTS = "CUSTOMER_EXISTS"

    # Operation errors
    PAYMENT_FAILED = "PAYMENT_FAILED"
    REFUND_FAILED = "REFUND_FAILED"
    PROVIDER_ERROR = "PROVIDER_ERROR"

    # Server errors
    INTERNAL_ERROR = "INTERNAL_ERROR"


class ErrorResponse(BaseModel):
    """Standard error response model."""

    code: str
    error: str
    details: dict[str, Any] | None = None
    trace_id: str | None = None


class APIError(Exception):
    """Base exception for API errors.

    Attributes:
        code: Error code from ErrorCode enum
        message: Human-readable error message
        status_code: HTTP status code
        details: Optional additional context
    """

    def __init__(
        self,
        code: ErrorCode | str,
        message: str,
        status_code: int = 400,
        details: dict[str, Any] | None = None,
    ) -> None:
        self.code = code if isinstance(code, str) else code.value
        self.message = message
        self.status_code = status_code
        self.details = details
        super().__init__(message)

    def to_response(self, trace_id: str | None = None) -> ErrorResponse:
        """Convert to ErrorResponse model."""
        return ErrorResponse(
            code=self.code,
            error=self.message,
            details=self.details,
            trace_id=trace_id or get_trace_id(),
        )


class MissingAPIKeyError(APIError):
    """Raised when API key is not provided."""

    def __init__(self, details: dict[str, Any] | None = None) -> None:
        super().__init__(
            code=ErrorCode.MISSING_API_KEY,
            message="API key is required. Provide it via X-API-Key header.",
            status_code=401,
            details=details,
        )


class InvalidAPIKeyError(APIError):
    """Raised when API key is invalid or inactive."""

    def __init__(self, details: dict[str, Any] | None = None) -> None:
        super().__init__(
            code=ErrorCode.INVALID_API_KEY,
            message="Invalid or inactive API key.",
            status_code=401,
            details=details,
        )


class UnauthorizedError(APIError):
    """Raised for general unauthorized access."""

    def __init__(
        self, message: str = "Unauthorized", details: dict[str, Any] | None = None
    ) -> None:
        super().__init__(
            code=ErrorCode.UNAUTHORIZED,
            message=message,
            status_code=401,
            details=details,
        )


class ForbiddenError(APIError):
    """Raised when access is denied."""

    def __init__(
        self, message: str = "Access denied", details: dict[str, Any] | None = None
    ) -> None:
        super().__init__(
            code=ErrorCode.FORBIDDEN,
            message=message,
            status_code=403,
            details=details,
        )


class BootstrapKeyNotAllowedError(APIError):
    """Raised when bootstrap key is used on non-allowed routes."""

    def __init__(self, details: dict[str, Any] | None = None) -> None:
        super().__init__(
            code=ErrorCode.BOOTSTRAP_KEY_NOT_ALLOWED,
            message="Bootstrap API key can only be used for API key creation.",
            status_code=403,
            details=details,
        )


class RateLimitExceededError(APIError):
    """Raised when rate limit is exceeded."""

    def __init__(
        self,
        limit: int,
        remaining: int,
        reset_at: int,
        details: dict[str, Any] | None = None,
    ) -> None:
        base_details = {
            "limit": limit,
            "remaining": remaining,
            "reset_at": reset_at,
        }
        if details:
            base_details.update(details)
        super().__init__(
            code=ErrorCode.RATE_LIMIT_EXCEEDED,
            message="Rate limit exceeded. Please try again later.",
            status_code=429,
            details=base_details,
        )
        self.limit = limit
        self.remaining = remaining
        self.reset_at = reset_at


class NotFoundError(APIError):
    """Raised when a resource is not found."""

    def __init__(
        self,
        message: str = "Resource not found",
        code: ErrorCode = ErrorCode.NOT_FOUND,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(
            code=code,
            message=message,
            status_code=404,
            details=details,
        )


class ValidationError(APIError):
    """Raised for request validation errors."""

    def __init__(
        self,
        message: str = "Validation error",
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(
            code=ErrorCode.VALIDATION_ERROR,
            message=message,
            status_code=400,
            details=details,
        )


class InternalError(APIError):
    """Raised for internal server errors."""

    def __init__(
        self,
        message: str = "Internal server error",
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(
            code=ErrorCode.INTERNAL_ERROR,
            message=message,
            status_code=500,
            details=details,
        )


class ConflictError(APIError):
    """Raised when a resource already exists."""

    def __init__(
        self,
        message: str = "Resource already exists",
        code: ErrorCode = ErrorCode.CUSTOMER_EXISTS,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(
            code=code,
            message=message,
            status_code=409,
            details=details,
        )


def create_error_response(
    code: ErrorCode | str,
    message: str,
    status_code: int,
    details: dict[str, Any] | None = None,
    trace_id: str | None = None,
) -> ORJSONResponse:
    """Create a standardized error response.

    Args:
        code: Error code
        message: Error message
        status_code: HTTP status code
        details: Optional additional context
        trace_id: Request trace ID

    Returns:
        ORJSONResponse with error payload
    """
    code_str = code if isinstance(code, str) else code.value
    response_data = ErrorResponse(
        code=code_str,
        error=message,
        details=details,
        trace_id=trace_id or get_trace_id(),
    )
    return ORJSONResponse(
        status_code=status_code,
        content=response_data.model_dump(exclude_none=True),
    )


async def api_error_handler(_request: Request, exc: APIError) -> ORJSONResponse:
    """Exception handler for APIError exceptions.

    Args:
        _request: FastAPI request
        exc: The APIError exception

    Returns:
        Standardized error response
    """
    return create_error_response(
        code=exc.code,
        message=exc.message,
        status_code=exc.status_code,
        details=exc.details,
    )
