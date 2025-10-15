# accounts/jwt_channels_middleware.py - Fixed import order
import logging
from urllib.parse import parse_qs
from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async

logger = logging.getLogger(__name__)


@database_sync_to_async
def get_user(user_id):
    from django.contrib.auth import get_user_model
    from django.contrib.auth.models import AnonymousUser

    User = get_user_model()
    try:
        return User.objects.get(id=user_id)
    except User.DoesNotExist:
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    def __init__(self, inner):
        super().__init__(inner)

    async def __call__(self, scope, receive, send):
        from django.contrib.auth.models import AnonymousUser
        from rest_framework_simplejwt.tokens import UntypedToken, AccessToken
        from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

        logger.info("JWT Middleware called!")

        # Extract token from query string
        query_string = scope.get('query_string', b'').decode()
        query_params = parse_qs(query_string)

        logger.info(f"Query params: {query_params}")

        token = None
        if 'token' in query_params:
            token = query_params['token'][0]
            logger.info(f"Token found: {token[:50]}...")

        if token:
            try:
                # Validate the token
                UntypedToken(token)

                # Decode token to get user ID
                access_token = AccessToken(token)
                user_id = access_token['user_id']

                logger.info(f"User ID from token: {user_id}")

                # Get user from database
                user = await get_user(user_id)
                scope['user'] = user

                if hasattr(user, 'username'):
                    logger.info(f"Authenticated: {user.username}")
                else:
                    logger.warning("User not found")

            except (InvalidToken, TokenError) as e:
                logger.error(f"Token validation failed: {e}")
                scope['user'] = AnonymousUser()
            except Exception as e:
                logger.error(f"Unexpected error: {e}")
                scope['user'] = AnonymousUser()
        else:
            logger.warning("No token provided")
            scope['user'] = AnonymousUser()

        return await super().__call__(scope, receive, send)


def JWTAuthMiddlewareStack(inner):
    return JWTAuthMiddleware(inner)
