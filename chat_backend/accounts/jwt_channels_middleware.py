
from urllib.parse import parse_qs
from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware


class JWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        from django.conf import settings
        from rest_framework_simplejwt.tokens import UntypedToken
        from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
        from rest_framework_simplejwt.authentication import JWTAuthentication
        from django.contrib.auth import get_user_model

        User = get_user_model()

        @database_sync_to_async
        def get_user(user_id):
            try:
                return User.objects.get(id=user_id)
            except User.DoesNotExist:
                return None

        token = None
        query_string = scope.get('query_string', b'').decode()
        query_params = parse_qs(query_string)
        if 'token' in query_params:
            token = query_params['token'][0]
        else:
            headers = dict(scope.get('headers', []))
            auth_header = headers.get(b'authorization')
            if auth_header:
                token = auth_header.decode().split(' ')[-1]

        scope['user'] = None
        if token:
            try:
                validated_token = UntypedToken(token)
                jwt_auth = JWTAuthentication()

                from asgiref.sync import sync_to_async
                user_obj = await sync_to_async(jwt_auth.get_user)(validated_token)
                user_id = validated_token[settings.SIMPLE_JWT['USER_ID_CLAIM']]
                user = await get_user(user_id)
                print(
                    f"[JWTAuthMiddleware] Authenticated user: {user} (type: {type(user)})")
                scope['user'] = user
            except (InvalidToken, TokenError, Exception) as e:
                print(f"[JWTAuthMiddleware] Token validation failed: {e}")
                scope['user'] = None

        print(f"[JWTAuthMiddleware] Final scope['user']: {scope['user']}")
        return await super().__call__(scope, receive, send)


def JWTAuthMiddlewareStack(inner):
    return JWTAuthMiddleware(inner)
