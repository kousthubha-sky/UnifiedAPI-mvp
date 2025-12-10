"""Customer API routes.

Provides the REST API endpoints for customer management.
"""

from __future__ import annotations

import os
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Request, Response

from app.auth import AuthContext, get_auth_context
from app.dependencies import get_supabase
from app.errors import (
    ConflictError,
    ErrorCode,
    ForbiddenError,
    InternalError,
    NotFoundError,
)
from app.app_logging import get_logger, get_trace_id
from app.models import (
    CreateCustomerRequest,
    CustomerResponse,
    UpdateCustomerRequest,
    parse_db_datetime,
)

logger = get_logger("customers.routes")

router = APIRouter(prefix="/api/v1/customers", tags=["customers"])

# Simple in-memory store for OAuth state (use Redis in production)
_oauth_states: dict[str, dict[str, Any]] = {}


def _get_optional_supabase() -> Any:
    """Get Supabase client, returning None if not available."""
    try:
        return get_supabase()
    except RuntimeError:
        return None


def _customer_from_db(data: dict[str, Any]) -> CustomerResponse:
    """Convert database row to CustomerResponse."""
    return CustomerResponse(
        id=str(data["id"]),
        email=data["email"],
        tier=data.get("tier", "starter"),
        stripe_account_id=data.get("stripe_account_id"),
        paypal_account_id=data.get("paypal_account_id"),
        created_at=parse_db_datetime(data.get("created_at")),
        updated_at=parse_db_datetime(data.get("updated_at")),
        trace_id=get_trace_id(),
    )


@router.post(
    "",
    response_model=CustomerResponse,
    status_code=201,
    summary="Create a customer",
    description=(
        "Create a new customer account. This endpoint is public and does not "
        "require authentication. Returns the created customer profile."
    ),
    responses={
        201: {"description": "Customer created successfully"},
        400: {"description": "Invalid request data"},
        409: {
            "description": "Customer with this email already exists",
            "content": {
                "application/json": {
                    "example": {
                        "code": "CUSTOMER_EXISTS",
                        "error": "Customer with this email already exists",
                        "details": {"email": "user@example.com"},
                    }
                }
            },
        },
        500: {"description": "Internal server error"},
    },
)
async def create_customer(
    body: CreateCustomerRequest,
) -> CustomerResponse:
    """Create a new customer.

    Args:
        body: Customer creation request body.

    Returns:
        CustomerResponse with the created customer profile.
    """
    logger.info(
        "Creating customer",
        email=body.email,
        user_id=body.user_id,
        tier=body.tier.value,
    )

    supabase = _get_optional_supabase()
    if supabase is None:
        raise InternalError(message="Database not available")

    try:
        print(f"Creating customer for email: {body.email}, user_id: {body.user_id}")
        # Check if customer already exists
        existing = supabase.table("customers").select("id, user_id").eq("email", body.email).execute()
        print(f"Existing check result: {existing.data}")

        if existing.data and len(existing.data) > 0:
            # Return existing customer
            customer_id = existing.data[0]["id"]
            # Update user_id if not set
            if body.user_id and not existing.data[0].get("user_id"):
                supabase.table("customers").update({"user_id": body.user_id}).eq("id", customer_id).execute()
            response = supabase.table("customers").select("*").eq("id", customer_id).single().execute()
            if not response.data:
                raise InternalError(message="Failed to fetch existing customer")
            customer_data = response.data
            logger.info(
                "Customer already exists, returning existing",
                customer_id=customer_id,
                email=body.email,
            )
        else:
            # Create customer
            now = datetime.now(UTC).isoformat()
            insert_data = {
                "email": body.email,
                "user_id": body.user_id,
                "tier": body.tier.value,
                "created_at": now,
                "updated_at": now,
            }

            if body.stripe_account_id:
                insert_data["stripe_account_id"] = body.stripe_account_id
            if body.paypal_account_id:
                insert_data["paypal_account_id"] = body.paypal_account_id

            print(f"Inserting new customer: {insert_data}")
            response = supabase.table("customers").insert(insert_data).execute()
            print(f"Insert result: {response.data}")

            if not response.data or len(response.data) == 0:
                raise InternalError(message="Failed to create customer")

            customer_data = response.data[0]
            print(f"Customer created: {customer_data}")
            logger.info(
                "Customer created",
                customer_id=customer_data["id"],
                email=body.email,
            )
        logger.info(
            "Customer created",
            customer_id=customer_data["id"],
            email=body.email,
        )

        return _customer_from_db(customer_data)

    except ConflictError:
        raise
    except InternalError:
        raise
    except Exception as e:
        logger.error("Failed to create customer", error=str(e))
        raise InternalError(
            message="Failed to create customer",
            details={"error": str(e)},
        ) from e


@router.get(
    "/{customer_id}",
    response_model=CustomerResponse,
    summary="Get customer profile",
    description="Retrieve a customer's profile by ID.",
    responses={
        200: {"description": "Customer profile retrieved"},
        401: {"description": "Missing or invalid API key"},
        403: {"description": "Access denied"},
        404: {"description": "Customer not found"},
    },
)
async def get_customer(
    request: Request,
    customer_id: str,
) -> CustomerResponse:
    """Get a customer's profile.

    Args:
        request: FastAPI request object.
        customer_id: The customer's UUID.

    Returns:
        CustomerResponse with the customer profile.
    """
    auth_ctx = get_auth_context(request)

    # Check authorization - users can only view their own profile unless admin
    if not _can_access_customer(auth_ctx, customer_id):
        raise ForbiddenError(
            message="You can only access your own profile",
            details={"customer_id": customer_id},
        )

    logger.info(
        "Getting customer",
        customer_id=customer_id,
    )

    supabase = _get_optional_supabase()
    if supabase is None:
        raise InternalError(message="Database not available")

    try:
        response = supabase.table("customers").select("*").eq("id", customer_id).single().execute()

        if not response.data:
            raise NotFoundError(
                message="Customer not found",
                code=ErrorCode.CUSTOMER_NOT_FOUND,
                details={"customer_id": customer_id},
            )

        return _customer_from_db(response.data)

    except NotFoundError:
        raise
    except Exception as e:
        logger.error("Failed to get customer", error=str(e))
        raise InternalError(
            message="Failed to get customer",
            details={"error": str(e)},
        ) from e


@router.patch(
    "/{customer_id}",
    response_model=CustomerResponse,
    summary="Update customer profile",
    description="Update a customer's profile. Users can only update their own profile.",
    responses={
        200: {"description": "Customer profile updated"},
        401: {"description": "Missing or invalid API key"},
        403: {"description": "Access denied"},
        404: {"description": "Customer not found"},
    },
)
async def update_customer(
    request: Request,
    customer_id: str,
    body: UpdateCustomerRequest,
) -> CustomerResponse:
    """Update a customer's profile.

    Args:
        request: FastAPI request object.
        customer_id: The customer's UUID.
        body: Update request body.

    Returns:
        CustomerResponse with the updated customer profile.
    """
    auth_ctx = get_auth_context(request)

    # Check authorization - users can only update their own profile unless admin
    if not _can_access_customer(auth_ctx, customer_id):
        raise ForbiddenError(
            message="You can only update your own profile",
            details={"customer_id": customer_id},
        )

    logger.info(
        "Updating customer",
        customer_id=customer_id,
    )

    supabase = _get_optional_supabase()
    if supabase is None:
        raise InternalError(message="Database not available")

    try:
        # Build update data
        update_data: dict[str, Any] = {
            "updated_at": datetime.now(UTC).isoformat(),
        }

        if body.email is not None:
            update_data["email"] = body.email
        if body.tier is not None:
            # Only admins can change tier
            if auth_ctx.tier != "admin" and not auth_ctx.is_static_key:
                raise ForbiddenError(
                    message="Only admins can change customer tier",
                )
            update_data["tier"] = body.tier.value
        if body.stripe_account_id is not None:
            update_data["stripe_account_id"] = body.stripe_account_id
        if body.paypal_account_id is not None:
            update_data["paypal_account_id"] = body.paypal_account_id

        response = supabase.table("customers").update(update_data).eq("id", customer_id).execute()

        if not response.data or len(response.data) == 0:
            raise NotFoundError(
                message="Customer not found",
                code=ErrorCode.CUSTOMER_NOT_FOUND,
                details={"customer_id": customer_id},
            )

        customer_data = response.data[0]
        logger.info(
            "Customer updated",
            customer_id=customer_id,
        )

        return _customer_from_db(customer_data)

    except (NotFoundError, ForbiddenError):
        raise
    except Exception as e:
        logger.error("Failed to update customer", error=str(e))
        raise InternalError(
            message="Failed to update customer",
            details={"error": str(e)},
        ) from e


@router.delete(
    "/{customer_id}",
    summary="Delete customer",
    description="Delete a customer account. Admin only.",
)
async def delete_customer(
    request: Request,
    customer_id: str,
) -> Response:
    """Delete a customer account.

    Args:
        request: FastAPI request object.
        customer_id: The customer's UUID.
    """
    auth_ctx = get_auth_context(request)

    # Only admins can delete customers
    if auth_ctx.tier != "admin" and not auth_ctx.is_static_key:
        raise ForbiddenError(
            message="Only admins can delete customers",
            details={"customer_id": customer_id},
        )

    logger.info(
        "Deleting customer",
        customer_id=customer_id,
    )

    supabase = _get_optional_supabase()
    if supabase is None:
        raise InternalError(message="Database not available")

    try:
        # Check if customer exists
        existing = supabase.table("customers").select("id").eq("id", customer_id).single().execute()

        if not existing.data:
            raise NotFoundError(
                message="Customer not found",
                code=ErrorCode.CUSTOMER_NOT_FOUND,
                details={"customer_id": customer_id},
            )

        # Delete customer (cascades to api_keys)
        supabase.table("customers").delete().eq("id", customer_id).execute()

        logger.info(
            "Customer deleted",
            customer_id=customer_id,
        )

        return Response(status_code=204)

    except NotFoundError:
        raise
    except Exception as e:
        logger.error("Failed to delete customer", error=str(e))
        raise InternalError(
            message="Failed to delete customer",
            details={"error": str(e)},
        ) from e


@router.get(
    "/oauth/stripe/connect",
    summary="Initiate Stripe Connect OAuth",
    description="Redirect to Stripe Connect OAuth flow",
)
async def initiate_stripe_connect(
    request: Request,
) -> Response:
    """Initiate Stripe Connect OAuth flow.

    Args:
        request: FastAPI request object.
    """
    import secrets
    from urllib.parse import urlencode

    auth_ctx = get_auth_context(request)
    customer_id = auth_ctx.customer_id

    # Generate a state parameter for CSRF protection
    state = secrets.token_urlsafe(32)

    # Store state in session/cache (simplified - in production use Redis/session)
    _oauth_states[state] = {
        'customer_id': customer_id,
        'provider': 'stripe',
        'timestamp': datetime.now(UTC).isoformat()
    }

    # Stripe Connect OAuth parameters
    params = {
        'response_type': 'code',
        'client_id': os.getenv('STRIPE_CONNECT_CLIENT_ID', 'ca_test_client_id'),  # Use test client ID
        'scope': 'read_write',
        'redirect_uri': f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/dashboard/setup/callback",
        'state': state,
    }

    stripe_oauth_url = f"https://connect.stripe.com/oauth/authorize?{urlencode(params)}"

    logger.info(
        "Initiating Stripe Connect OAuth",
        customer_id=customer_id,
        state=state,
    )

    # Redirect to Stripe OAuth
    return Response(
        status_code=302,
        headers={"Location": stripe_oauth_url}
    )


@router.get(
    "/oauth/stripe/callback",
    summary="Handle Stripe Connect OAuth callback",
    description="Handle the callback from Stripe Connect OAuth",
)
async def handle_stripe_connect_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
) -> Response:
    """Handle Stripe Connect OAuth callback.

    Args:
        request: FastAPI request object.
        code: Authorization code from Stripe.
        state: State parameter for CSRF protection.
        error: Error from Stripe OAuth.
        error_description: Error description from Stripe OAuth.
    """
    import httpx

    # Check for OAuth errors
    if error:
        logger.error(
            "Stripe Connect OAuth error",
            error=error,
            error_description=error_description,
        )
        return Response(
            status_code=302,
            headers={"Location": f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/dashboard/setup?error={error}"}
        )

    if not code or not state:
        logger.error("Missing code or state in Stripe Connect callback")
        return Response(
            status_code=302,
            headers={"Location": f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/dashboard/setup?error=missing_params"}
        )

    # Verify state (simplified - in production use Redis/session)
    state_data = _oauth_states.get(state)
    if not state_data:
        logger.error("Invalid state parameter in Stripe Connect callback")
        return Response(
            status_code=302,
            headers={"Location": f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/dashboard/setup?error=invalid_state"}
        )

    customer_id = state_data['customer_id']

    # Clean up state
    del _oauth_states[state]

    try:
        # Exchange authorization code for access token
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://connect.stripe.com/oauth/token",
                data={
                    'client_secret': os.getenv('STRIPE_SECRET_KEY', 'sk_test_key'),
                    'code': code,
                    'grant_type': 'authorization_code',
                }
            )

            if response.status_code != 200:
                logger.error(
                    "Failed to exchange Stripe Connect code for token",
                    status_code=response.status_code,
                    response=response.text,
                )
                return Response(
                    status_code=302,
                    headers={"Location": f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/dashboard/setup?error=token_exchange_failed"}
                )

            token_data = response.json()
            stripe_account_id = token_data.get('stripe_user_id')

            if not stripe_account_id:
                logger.error("No stripe_user_id in token response")
                return Response(
                    status_code=302,
                    headers={"Location": f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/dashboard/setup?error=no_account_id"}
                )

            # Update customer with Stripe account ID
            supabase = get_supabase(request)
            update_response = supabase.table("customers").update({
                "stripe_account_id": stripe_account_id,
                "updated_at": datetime.now(UTC).isoformat()
            }).eq("id", customer_id).execute()

            if not update_response.data or len(update_response.data) == 0:
                logger.error("Failed to update customer with Stripe account ID")
                return Response(
                    status_code=302,
                    headers={"Location": f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/dashboard/setup?error=update_failed"}
                )

            logger.info(
                "Stripe Connect OAuth completed successfully",
                customer_id=customer_id,
                stripe_account_id=stripe_account_id,
            )

            return Response(
                status_code=302,
                headers={"Location": f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/dashboard/setup?success=true"}
            )

    except Exception as e:
        logger.error("Stripe Connect OAuth callback error", error=str(e))
        return Response(
            status_code=302,
            headers={"Location": f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/dashboard/setup?error=server_error"}
        )


def _can_access_customer(auth_ctx: AuthContext, customer_id: str) -> bool:
    """Check if the authenticated user can access a customer's data.

    Args:
        auth_ctx: Authentication context.
        customer_id: The customer ID to access.

    Returns:
        True if access is allowed.
    """
    # Admins and static key users can access any customer
    if auth_ctx.tier == "admin" or auth_ctx.is_static_key:
        return True

    # Users can only access their own data
    return auth_ctx.customer_id == customer_id
