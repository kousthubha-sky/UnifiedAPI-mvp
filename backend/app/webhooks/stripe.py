"""Stripe webhook signature verification."""

import stripe
from fastapi import Request, HTTPException

from app.config import get_settings
from app.payments.credential_service import PaymentCredentialService


async def verify_stripe_webhook(request: Request, credential_service: PaymentCredentialService) -> stripe.Event:
    """Verify Stripe webhook signature.

    Args:
        request: FastAPI request object
        credential_service: Service for accessing encrypted credentials

    Returns:
        Verified Stripe event

    Raises:
        HTTPException: If signature verification fails
    """
    settings = get_settings()
    payload = await request.body()
    sig_header = request.headers.get('stripe-signature')

    if not sig_header:
        raise HTTPException(status_code=400, detail="Missing stripe-signature header")

    webhook_secret = await credential_service.get_credential_value(
        settings.environment, 'stripe', 'webhook_secret'
    )

    if not webhook_secret:
        raise HTTPException(status_code=500, detail="Webhook secret not configured")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )
        return event
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")