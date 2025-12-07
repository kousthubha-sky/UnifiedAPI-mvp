"""Structured logging configuration using structlog.

Mirrors the Pino logging fields from the Node.js backend:
- type/action
- trace_id
- latency_ms (duration)
- method, url, status_code, ip
- timestamp

Outputs JSON in production, pretty-printed logs in development.
"""

import logging
import sys
import time
from contextvars import ContextVar
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

import structlog
from structlog.types import EventDict, Processor

from app.config import get_settings

# Context variable for request-scoped trace ID
trace_id_ctx: ContextVar[str | None] = ContextVar("trace_id", default=None)
request_start_time_ctx: ContextVar[float | None] = ContextVar("request_start_time", default=None)


def get_trace_id() -> str:
    """Get current trace ID or generate a new one."""
    current = trace_id_ctx.get()
    if current is None:
        current = str(uuid4())
        trace_id_ctx.set(current)
    return current


def set_trace_id(trace_id: str | None = None) -> str:
    """Set the trace ID for the current context."""
    new_id = trace_id or str(uuid4())
    trace_id_ctx.set(new_id)
    return new_id


def start_request_timer() -> float:
    """Start timing a request."""
    start_time = time.perf_counter()
    request_start_time_ctx.set(start_time)
    return start_time


def get_request_latency_ms() -> float | None:
    """Get request latency in milliseconds."""
    start_time = request_start_time_ctx.get()
    if start_time is None:
        return None
    return round((time.perf_counter() - start_time) * 1000, 2)


def add_trace_id(
    _logger: logging.Logger, _method_name: str, event_dict: EventDict
) -> EventDict:
    """Processor to add trace_id to all log entries."""
    trace_id = trace_id_ctx.get()
    if trace_id:
        event_dict["trace_id"] = trace_id
    return event_dict


def add_timestamp(
    _logger: logging.Logger, _method_name: str, event_dict: EventDict
) -> EventDict:
    """Processor to add ISO format timestamp."""
    event_dict["timestamp"] = datetime.now(UTC).isoformat()
    return event_dict


def rename_event_key(
    _logger: logging.Logger, _method_name: str, event_dict: EventDict
) -> EventDict:
    """Rename 'event' to 'message' for Pino compatibility."""
    if "event" in event_dict:
        event_dict["message"] = event_dict.pop("event")
    return event_dict


def add_log_level(
    _logger: logging.Logger, method_name: str, event_dict: EventDict
) -> EventDict:
    """Add log level to event dict."""
    event_dict["level"] = method_name
    return event_dict


def get_shared_processors() -> list[Processor]:
    """Get processors shared between development and production."""
    return [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_logger_name,
        add_log_level,
        add_timestamp,
        add_trace_id,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.stdlib.ExtraAdder(),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.UnicodeDecoder(),
    ]


def configure_logging() -> None:
    """Configure structured logging for the application.

    Sets up structlog with:
    - JSON output in production
    - Pretty console output in development
    - Pino-compatible field names
    """
    settings = get_settings()

    # Map our log levels to Python logging levels
    level_map = {
        "debug": logging.DEBUG,
        "info": logging.INFO,
        "warning": logging.WARNING,
        "error": logging.ERROR,
        "critical": logging.CRITICAL,
    }
    log_level = level_map.get(settings.log_level, logging.INFO)

    shared_processors = get_shared_processors()

    if settings.is_production:
        # Production: JSON output
        processors: list[Processor] = [
            *shared_processors,
            rename_event_key,
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ]
    else:
        # Development: Pretty console output
        processors = [
            *shared_processors,
            structlog.processors.format_exc_info,
            structlog.dev.ConsoleRenderer(
                colors=True,
                exception_formatter=structlog.dev.plain_traceback,
            ),
        ]

    # Configure structlog
    structlog.configure(
        processors=processors,
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    # Configure standard library logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=log_level,
    )

    # Set log levels for noisy libraries
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    """Get a structured logger instance.

    Args:
        name: Optional logger name. Defaults to 'app'.

    Returns:
        A configured structlog BoundLogger instance.
    """
    return structlog.get_logger(name or "app")


def audit_log(action: str, **details: Any) -> None:
    """Log an audit entry.

    Mirrors the auditLog function from the Node.js backend.

    Args:
        action: The action being audited (e.g., "PAYMENT_CREATED")
        **details: Additional details to include in the log
    """
    logger = get_logger("audit")
    logger.info(
        action,
        type="AUDIT",
        action=action,
        **details,
    )


def request_log(
    method: str,
    url: str,
    ip: str | None = None,
    **extra: Any,
) -> None:
    """Log an incoming request.

    Args:
        method: HTTP method
        url: Request URL
        ip: Client IP address
        **extra: Additional fields
    """
    logger = get_logger("request")
    logger.info(
        "Request received",
        type="REQUEST",
        method=method,
        url=url,
        ip=ip,
        **extra,
    )


def response_log(
    method: str,
    url: str,
    status_code: int,
    latency_ms: float | None = None,
    **extra: Any,
) -> None:
    """Log a response.

    Args:
        method: HTTP method
        url: Request URL
        status_code: Response status code
        latency_ms: Request latency in milliseconds
        **extra: Additional fields
    """
    logger = get_logger("response")
    log_data: dict[str, Any] = {
        "type": "RESPONSE",
        "method": method,
        "url": url,
        "status_code": status_code,
    }

    if latency_ms is not None:
        log_data["latency_ms"] = latency_ms
        log_data["duration"] = f"{latency_ms}ms"

    logger.info(
        "Response sent",
        **log_data,
        **extra,
    )


def error_log(
    error: Exception | str,
    context: dict[str, Any] | None = None,
) -> None:
    """Log an error.

    Args:
        error: The error to log
        context: Additional context
    """
    logger = get_logger("error")
    ctx = context or {}

    if isinstance(error, Exception):
        logger.error(
            str(error),
            type="ERROR",
            error=str(error),
            error_type=type(error).__name__,
            **ctx,
            exc_info=error,
        )
    else:
        logger.error(
            error,
            type="ERROR",
            error=error,
            **ctx,
        )
