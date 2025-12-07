"""Payment audit logging helpers.

Writes audit entries to both structured logs and the Supabase audit_logs table.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from supabase import Client as SupabaseClient

from app.logging import audit_log, get_logger, get_trace_id

logger = get_logger("payments.audit")


class AuditAction:
    """Standard audit action constants."""

    PAYMENT_CREATED = "PAYMENT_CREATED"
    PAYMENT_FAILED = "PAYMENT_FAILED"
    REFUND_CREATED = "REFUND_CREATED"
    REFUND_FAILED = "REFUND_FAILED"
    PAYMENT_STATUS_CHECK = "PAYMENT_STATUS_CHECK"
    PAYMENTS_LISTED = "PAYMENTS_LISTED"


async def log_payment_audit(
    supabase: SupabaseClient | None,
    action: str,
    customer_id: str | None,
    endpoint: str,
    method: str,
    provider: str | None = None,
    status: int = 200,
    latency_ms: int | None = None,
    error_message: str | None = None,
    request_body: dict[str, Any] | None = None,
    response_body: dict[str, Any] | None = None,
    provider_transaction_id: str | None = None,
    trace_id: str | None = None,
) -> None:
    """Log a payment audit entry.

    Writes to both structured logs (via audit_log) and the Supabase audit_logs table.

    Args:
        supabase: Supabase client (optional, will skip DB write if None).
        action: The audit action (e.g., PAYMENT_CREATED).
        customer_id: Customer ID for the request.
        endpoint: API endpoint path.
        method: HTTP method.
        provider: Payment provider name.
        status: HTTP status code.
        latency_ms: Request latency in milliseconds.
        error_message: Error message if the operation failed.
        request_body: Request body (sanitized - no sensitive data).
        response_body: Response body.
        provider_transaction_id: Provider's transaction ID.
        trace_id: Request trace ID (will use current context if not provided).
    """
    current_trace_id = trace_id or get_trace_id()

    # Log to structured logger
    # Note: audit_log takes action as first param and adds it to details already
    log_data: dict[str, Any] = {
        "customer_id": customer_id,
        "endpoint": endpoint,
        "method": method,
        "status": status,
    }

    if provider:
        log_data["provider"] = provider
    if latency_ms is not None:
        log_data["latency_ms"] = latency_ms
    if provider_transaction_id:
        log_data["provider_transaction_id"] = provider_transaction_id
    if error_message:
        log_data["error_message"] = error_message

    audit_log(action, **log_data)

    # Write to Supabase audit_logs table
    if supabase:
        try:
            # Sanitize request body (remove sensitive fields)
            sanitized_request = _sanitize_request_body(request_body) if request_body else None

            audit_record = {
                "trace_id": current_trace_id,
                "customer_id": customer_id,
                "endpoint": endpoint,
                "method": method,
                "provider": provider,
                "status": status,
                "latency_ms": latency_ms,
                "error_message": error_message,
                "request_body": sanitized_request,
                "response_body": response_body,
                "created_at": datetime.now(UTC).isoformat(),
            }

            # Remove None values
            audit_record = {k: v for k, v in audit_record.items() if v is not None}

            supabase.table("audit_logs").insert(audit_record).execute()

            logger.debug(
                "Audit record written to database",
                trace_id=current_trace_id,
                action=action,
            )

        except Exception as e:
            # Don't fail the request if audit logging fails
            logger.warning(
                "Failed to write audit log to database",
                error=str(e),
                trace_id=current_trace_id,
            )


def _sanitize_request_body(body: dict[str, Any]) -> dict[str, Any]:
    """Remove sensitive fields from request body.

    Args:
        body: Original request body.

    Returns:
        Sanitized copy of the body.
    """
    sensitive_fields = {
        "payment_method",
        "card_number",
        "cvv",
        "cvc",
        "expiry",
        "exp_month",
        "exp_year",
        "api_key",
        "secret",
        "password",
        "token",
    }

    sanitized = {}
    for key, value in body.items():
        if key.lower() in sensitive_fields:
            sanitized[key] = "[REDACTED]"
        elif isinstance(value, dict):
            sanitized[key] = _sanitize_request_body(value)
        else:
            sanitized[key] = value

    return sanitized


async def log_payment_success(
    supabase: SupabaseClient | None,
    customer_id: str | None,
    endpoint: str,
    method: str,
    provider: str,
    provider_transaction_id: str,
    amount: int,
    currency: str,
    latency_ms: int | None = None,
    request_body: dict[str, Any] | None = None,
) -> None:
    """Log a successful payment creation.

    Args:
        supabase: Supabase client.
        customer_id: Customer ID.
        endpoint: API endpoint.
        method: HTTP method.
        provider: Payment provider.
        provider_transaction_id: Provider's transaction ID.
        amount: Payment amount.
        currency: Currency code.
        latency_ms: Request latency.
        request_body: Original request body.
    """
    await log_payment_audit(
        supabase=supabase,
        action=AuditAction.PAYMENT_CREATED,
        customer_id=customer_id,
        endpoint=endpoint,
        method=method,
        provider=provider,
        status=200,
        latency_ms=latency_ms,
        request_body=request_body,
        response_body={
            "provider_transaction_id": provider_transaction_id,
            "amount": amount,
            "currency": currency,
        },
        provider_transaction_id=provider_transaction_id,
    )


async def log_payment_failure(
    supabase: SupabaseClient | None,
    customer_id: str | None,
    endpoint: str,
    method: str,
    provider: str | None,
    error_message: str,
    status: int = 400,
    latency_ms: int | None = None,
    request_body: dict[str, Any] | None = None,
) -> None:
    """Log a failed payment attempt.

    Args:
        supabase: Supabase client.
        customer_id: Customer ID.
        endpoint: API endpoint.
        method: HTTP method.
        provider: Payment provider.
        error_message: Error message.
        status: HTTP status code.
        latency_ms: Request latency.
        request_body: Original request body.
    """
    await log_payment_audit(
        supabase=supabase,
        action=AuditAction.PAYMENT_FAILED,
        customer_id=customer_id,
        endpoint=endpoint,
        method=method,
        provider=provider,
        status=status,
        latency_ms=latency_ms,
        error_message=error_message,
        request_body=request_body,
    )


async def log_refund_success(
    supabase: SupabaseClient | None,
    customer_id: str | None,
    endpoint: str,
    method: str,
    provider: str,
    refund_id: str,
    original_transaction_id: str,
    amount: int,
    latency_ms: int | None = None,
) -> None:
    """Log a successful refund.

    Args:
        supabase: Supabase client.
        customer_id: Customer ID.
        endpoint: API endpoint.
        method: HTTP method.
        provider: Payment provider.
        refund_id: Refund ID.
        original_transaction_id: Original payment transaction ID.
        amount: Refund amount.
        latency_ms: Request latency.
    """
    await log_payment_audit(
        supabase=supabase,
        action=AuditAction.REFUND_CREATED,
        customer_id=customer_id,
        endpoint=endpoint,
        method=method,
        provider=provider,
        status=200,
        latency_ms=latency_ms,
        response_body={
            "refund_id": refund_id,
            "original_transaction_id": original_transaction_id,
            "amount": amount,
        },
        provider_transaction_id=refund_id,
    )


async def log_refund_failure(
    supabase: SupabaseClient | None,
    customer_id: str | None,
    endpoint: str,
    method: str,
    provider: str | None,
    error_message: str,
    status: int = 400,
    latency_ms: int | None = None,
) -> None:
    """Log a failed refund attempt.

    Args:
        supabase: Supabase client.
        customer_id: Customer ID.
        endpoint: API endpoint.
        method: HTTP method.
        provider: Payment provider.
        error_message: Error message.
        status: HTTP status code.
        latency_ms: Request latency.
    """
    await log_payment_audit(
        supabase=supabase,
        action=AuditAction.REFUND_FAILED,
        customer_id=customer_id,
        endpoint=endpoint,
        method=method,
        provider=provider,
        status=status,
        latency_ms=latency_ms,
        error_message=error_message,
    )
