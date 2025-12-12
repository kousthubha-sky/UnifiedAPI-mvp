"""Payment provider adapters.

Each adapter implements the PaymentProviderAdapter interface for a specific provider.
"""

from app.payments.providers.base import (
    PaymentProviderAdapter,
    ProviderPaymentResult,
    ProviderRefundResult,
)
from app.payments.providers.paypal import PayPalAdapter

__all__ = [
    "PaymentProviderAdapter",
    "ProviderPaymentResult",
    "ProviderRefundResult",
    "PayPalAdapter",
]
