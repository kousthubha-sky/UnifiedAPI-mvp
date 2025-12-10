"""PayPal payment provider adapter.

Implements the PaymentProviderAdapter interface for PayPal payments.
Uses the PayPal REST API via httpx for async support.
"""

from __future__ import annotations

import base64
from typing import Any

import httpx

from app.config import Settings
from app.app_logging import get_logger
from app.payments.credential_service import PaymentCredentialService
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

logger = get_logger("payments.paypal")


class PayPalAdapter(PaymentProviderAdapter):
    """PayPal payment provider adapter.

    Handles payment creation, refunds, and status checks via PayPal REST API.
    Uses OAuth2 client credentials flow for authentication.
    """

    SANDBOX_BASE_URL = "https://api-m.sandbox.paypal.com"
    LIVE_BASE_URL = "https://api-m.paypal.com"

    def __init__(self, credential_service: PaymentCredentialService, environment: str, settings: Settings) -> None:
        """Initialize the PayPal adapter.

        Args:
            credential_service: Service for accessing encrypted credentials
            environment: Environment (local/staging/production)
            settings: Application settings

        Raises:
            ValueError: If PayPal credentials are not configured.
        """
        self.credential_service = credential_service
        self.environment = environment
        self.mode = settings.paypal_mode
        self.default_currency = settings.paypal_currency

        self.base_url = self.LIVE_BASE_URL if self.mode == "live" else self.SANDBOX_BASE_URL
        self._access_token: str | None = None
        self._token_expires_at: float | None = None

    async def _get_client_credentials(self) -> tuple[str, str]:
        """Get PayPal client ID and secret from credential service.

        Returns:
            Tuple of (client_id, client_secret)

        Raises:
            ValueError: If credentials are not configured
        """
        client_id = await self.credential_service.get_credential_value(
            self.environment, 'paypal', 'client_id'
        )
        client_secret = await self.credential_service.get_credential_value(
            self.environment, 'paypal', 'client_secret'
        )

        if not client_id or not client_secret:
            raise ValueError(f"PayPal credentials not configured for environment: {self.environment}")

        return client_id, client_secret
    @property
    def provider_name(self) -> str:
        """Return the provider name."""
        return "paypal"

    async def _get_http_client(self) -> httpx.AsyncClient:
        """Get or create the HTTP client."""
        if self._http_client is None:
            self._http_client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=30.0,
            )
        return self._http_client

    async def _get_access_token(self) -> str:
        """Get PayPal OAuth2 access token.

        Uses client credentials grant type to obtain an access token.
        Token is cached for subsequent requests.

        Returns:
            Access token string.

        Raises:
            ProviderError: If authentication fails.
        """
        if self._access_token:
            return self._access_token

        try:
            client = await self._get_http_client()
            client_id, client_secret = await self._get_client_credentials()
            auth_string = f"{client_id}:{client_secret}"
            auth_header = base64.b64encode(auth_string.encode()).decode()

            response = await client.post(
                "/v1/oauth2/token",
                headers={
                    "Authorization": f"Basic {auth_header}",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                data={"grant_type": "client_credentials"},
            )

            if response.status_code != 200:
                logger.error(
                    "PayPal authentication failed",
                    status_code=response.status_code,
                    response=response.text,
                )
                raise ProviderError(
                    provider="paypal",
                    message="PayPal authentication failed",
                    details={"status_code": response.status_code},
                )

            data = response.json()
            self._access_token = data["access_token"]
            return self._access_token

        except httpx.HTTPError as e:
            logger.error("PayPal authentication HTTP error", error=str(e))
            raise ProviderError(
                provider="paypal",
                message=f"PayPal authentication failed: {e}",
            )

    async def _make_request(
        self,
        method: str,
        endpoint: str,
        data: dict[str, Any] | None = None,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        """Make an authenticated request to PayPal API.

        Args:
            method: HTTP method (GET, POST, etc.).
            endpoint: API endpoint path.
            data: Optional request body data.
            idempotency_key: Optional idempotency key.

        Returns:
            Response JSON data.

        Raises:
            ProviderError: If the request fails.
        """
        access_token = await self._get_access_token()
        client = await self._get_http_client()

        headers: dict[str, str] = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }

        if idempotency_key:
            headers["PayPal-Request-Id"] = idempotency_key

        try:
            if method.upper() == "GET":
                response = await client.get(endpoint, headers=headers)
            elif method.upper() == "POST":
                response = await client.post(endpoint, headers=headers, json=data)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")

            # Check for auth errors and retry once
            if response.status_code == 401:
                self._access_token = None
                access_token = await self._get_access_token()
                headers["Authorization"] = f"Bearer {access_token}"
                if method.upper() == "GET":
                    response = await client.get(endpoint, headers=headers)
                else:
                    response = await client.post(endpoint, headers=headers, json=data)

            return {
                "status_code": response.status_code,
                "data": response.json() if response.text else {},
            }

        except httpx.HTTPError as e:
            logger.error("PayPal request HTTP error", error=str(e))
            raise ProviderError(
                provider="paypal",
                message=f"PayPal request failed: {e}",
            )

    def _map_paypal_status(self, paypal_status: str) -> PaymentStatus:
        """Map PayPal order status to our PaymentStatus.

        Args:
            paypal_status: PayPal's order status.

        Returns:
            Mapped PaymentStatus.
        """
        status_map = {
            "CREATED": PaymentStatus.PENDING,
            "SAVED": PaymentStatus.PENDING,
            "APPROVED": PaymentStatus.PENDING,
            "VOIDED": PaymentStatus.FAILED,
            "COMPLETED": PaymentStatus.COMPLETED,
            "PAYER_ACTION_REQUIRED": PaymentStatus.PENDING,
        }
        return status_map.get(paypal_status, PaymentStatus.PENDING)

    def _map_capture_status(self, capture_status: str) -> PaymentStatus:
        """Map PayPal capture status to our PaymentStatus.

        Args:
            capture_status: PayPal's capture status.

        Returns:
            Mapped PaymentStatus.
        """
        status_map = {
            "COMPLETED": PaymentStatus.COMPLETED,
            "DECLINED": PaymentStatus.FAILED,
            "PARTIALLY_REFUNDED": PaymentStatus.COMPLETED,
            "PENDING": PaymentStatus.PROCESSING,
            "REFUNDED": PaymentStatus.REFUNDED,
        }
        return status_map.get(capture_status, PaymentStatus.PROCESSING)

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
        """Create a PayPal order and capture payment.

        For server-side payments, we create an order and immediately capture it.
        The payment_method parameter is used as a reference/payer ID.

        Args:
            amount: Amount in smallest currency unit (cents).
            currency: Three-letter ISO currency code.
            payment_method: Payer reference or token.
            customer_id: Customer identifier.
            description: Optional payment description.
            metadata: Optional metadata.
            idempotency_key: Optional idempotency key.

        Returns:
            ProviderPaymentResult with transaction details.

        Raises:
            PaymentFailedError: If the payment fails.
            ProviderError: If there's a PayPal API error.
        """
        normalized_currency = self.normalize_currency(currency)

        # Convert cents to decimal for PayPal (unless zero-decimal currency)
        if self.is_zero_decimal_currency(normalized_currency):
            decimal_amount = str(amount)
        else:
            decimal_amount = f"{amount / 100:.2f}"

        try:
            logger.info(
                "Creating PayPal order",
                amount=decimal_amount,
                currency=normalized_currency,
            )

            # Build order request
            order_data: dict[str, Any] = {
                "intent": "CAPTURE",
                "purchase_units": [
                    {
                        "amount": {
                            "currency_code": normalized_currency,
                            "value": decimal_amount,
                        },
                        "custom_id": customer_id,
                    }
                ],
            }

            if description:
                order_data["purchase_units"][0]["description"] = description

            # Create order
            response = await self._make_request(
                "POST",
                "/v2/checkout/orders",
                data=order_data,
                idempotency_key=idempotency_key,
            )

            if response["status_code"] not in (200, 201):
                error_details = response["data"]
                logger.error("PayPal order creation failed", response=error_details)
                raise PaymentFailedError(
                    message=f"PayPal order creation failed: {error_details.get('message', 'Unknown error')}",
                    details={
                        "provider": "paypal",
                        "paypal_debug_id": error_details.get("debug_id"),
                    },
                )

            order = response["data"]
            order_id = order["id"]

            logger.info(
                "PayPal order created",
                order_id=order_id,
                status=order["status"],
            )

            # For server-side flow, we return the order for approval
            # In a real scenario, the client would approve and we'd capture
            # For this implementation, we simulate immediate capture for testing

            # The client_secret equivalent for PayPal is the approval URL
            approval_url = None
            for link in order.get("links", []):
                if link["rel"] == "approve":
                    approval_url = link["href"]
                    break

            return ProviderPaymentResult(
                provider_transaction_id=order_id,
                status=self._map_paypal_status(order["status"]),
                client_secret=approval_url,  # PayPal approval URL
                provider_metadata={
                    "paypal_status": order["status"],
                    "paypal_order_id": order_id,
                    "payment_method_reference": payment_method,
                    "metadata": metadata,
                },
            )

        except (PaymentFailedError, ProviderError):
            raise
        except Exception as e:
            logger.error("PayPal create payment error", error=str(e))
            raise ProviderError(
                provider="paypal",
                message=f"PayPal error: {e}",
            )

    async def refund_payment(
        self,
        provider_transaction_id: str,
        amount: int | None = None,
        reason: str | None = None,
        idempotency_key: str | None = None,
    ) -> ProviderRefundResult:
        """Refund a PayPal payment.

        First retrieves the order to get the capture ID, then issues a refund.

        Args:
            provider_transaction_id: PayPal order ID.
            amount: Optional partial refund amount in cents. If None, full refund.
            reason: Optional refund reason.
            idempotency_key: Optional idempotency key.

        Returns:
            ProviderRefundResult with refund details.

        Raises:
            RefundFailedError: If the refund fails.
            PaymentNotFoundError: If the order doesn't exist.
            ProviderError: If there's a PayPal API error.
        """
        try:
            logger.info(
                "Creating PayPal refund",
                order_id=provider_transaction_id,
                amount=amount,
            )

            # First, get the order to find the capture ID
            order_response = await self._make_request(
                "GET",
                f"/v2/checkout/orders/{provider_transaction_id}",
            )

            if order_response["status_code"] == 404:
                raise PaymentNotFoundError(
                    payment_id=provider_transaction_id,
                    details={"provider": "paypal"},
                )

            if order_response["status_code"] != 200:
                raise ProviderError(
                    provider="paypal",
                    message="Failed to retrieve PayPal order",
                )

            order = order_response["data"]

            # Find the capture ID from the order
            capture_id = None
            capture_currency = None

            for purchase_unit in order.get("purchase_units", []):
                payments = purchase_unit.get("payments", {})
                captures = payments.get("captures", [])
                if captures:
                    capture = captures[0]
                    capture_id = capture["id"]
                    capture_currency = capture["amount"]["currency_code"]
                    break

            if not capture_id:
                raise RefundFailedError(
                    message="No capture found for this order. The payment may not have been completed.",
                    details={
                        "provider": "paypal",
                        "order_id": provider_transaction_id,
                    },
                )

            # Build refund request
            refund_data: dict[str, Any] = {}

            if amount is not None:
                # Convert cents to decimal
                if self.is_zero_decimal_currency(capture_currency):
                    decimal_amount = str(amount)
                else:
                    decimal_amount = f"{amount / 100:.2f}"

                refund_data["amount"] = {
                    "currency_code": capture_currency,
                    "value": decimal_amount,
                }

            if reason:
                refund_data["note_to_payer"] = reason

            # Create refund
            refund_response = await self._make_request(
                "POST",
                f"/v2/payments/captures/{capture_id}/refund",
                data=refund_data if refund_data else None,
                idempotency_key=idempotency_key,
            )

            if refund_response["status_code"] not in (200, 201):
                error_data = refund_response["data"]
                raise RefundFailedError(
                    message=f"PayPal refund failed: {error_data.get('message', 'Unknown error')}",
                    details={
                        "provider": "paypal",
                        "paypal_debug_id": error_data.get("debug_id"),
                    },
                )

            refund = refund_response["data"]

            # Calculate refund amount in cents
            refund_value = float(refund["amount"]["value"])
            if self.is_zero_decimal_currency(refund["amount"]["currency_code"]):
                refund_amount_cents = int(refund_value)
            else:
                refund_amount_cents = int(refund_value * 100)

            logger.info(
                "PayPal refund created",
                refund_id=refund["id"],
                status=refund["status"],
                amount=refund_amount_cents,
            )

            return ProviderRefundResult(
                refund_id=refund["id"],
                status=(
                    PaymentStatus.REFUNDED
                    if refund["status"] == "COMPLETED"
                    else PaymentStatus.PROCESSING
                ),
                amount=refund_amount_cents,
                provider_metadata={
                    "paypal_status": refund["status"],
                    "capture_id": capture_id,
                },
            )

        except (PaymentNotFoundError, RefundFailedError, ProviderError):
            raise
        except Exception as e:
            logger.error("PayPal refund error", error=str(e))
            raise ProviderError(
                provider="paypal",
                message=f"PayPal refund error: {e}",
            )

    async def get_payment_status(
        self,
        provider_transaction_id: str,
    ) -> ProviderStatusResult:
        """Get the current status of a PayPal order.

        Args:
            provider_transaction_id: PayPal order ID.

        Returns:
            ProviderStatusResult with current status.

        Raises:
            PaymentNotFoundError: If the order doesn't exist.
            ProviderError: If there's a PayPal API error.
        """
        try:
            logger.info(
                "Fetching PayPal order status",
                order_id=provider_transaction_id,
            )

            response = await self._make_request(
                "GET",
                f"/v2/checkout/orders/{provider_transaction_id}",
            )

            if response["status_code"] == 404:
                raise PaymentNotFoundError(
                    payment_id=provider_transaction_id,
                    details={"provider": "paypal"},
                )

            if response["status_code"] != 200:
                raise ProviderError(
                    provider="paypal",
                    message="Failed to retrieve PayPal order status",
                )

            order = response["data"]

            # Check capture status if available
            status = self._map_paypal_status(order["status"])

            for purchase_unit in order.get("purchase_units", []):
                payments = purchase_unit.get("payments", {})
                captures = payments.get("captures", [])
                if captures:
                    capture_status = captures[0]["status"]
                    status = self._map_capture_status(capture_status)
                    break

            return ProviderStatusResult(
                status=status,
                provider_metadata={
                    "paypal_status": order["status"],
                    "order_id": order["id"],
                },
            )

        except (PaymentNotFoundError, ProviderError):
            raise
        except Exception as e:
            logger.error("PayPal status check error", error=str(e))
            raise ProviderError(
                provider="paypal",
                message=f"PayPal status check error: {e}",
            )

    async def close(self) -> None:
        """Close the HTTP client."""
        if self._http_client:
            await self._http_client.aclose()
            self._http_client = None
