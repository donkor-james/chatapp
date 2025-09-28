# chat_backend/asgi.py - VSCode-safe version
from notifications.consumers import NotificationConsumer
from chats.consumers import ChatConsumer
from chats.user_chats_consumer import UserChatsConsumer
from accounts.jwt_channels_middleware import JWTAuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from django.urls import re_path
from django.core.asgi import get_asgi_application
import os
import django

# CRITICAL: Set Django settings and initialize BEFORE any other imports
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'chat_backend.settings')
django.setup()

# Now import everything else (VSCode can reorder these safely)

# WebSocket URL patterns
websocket_urlpatterns = [
    re_path(r'ws/chat/(?P<chat_id>\w+)/$', ChatConsumer.as_asgi()),
    re_path(r'ws/user-chats/$', UserChatsConsumer.as_asgi()),
    re_path(r'ws/notifications/$', NotificationConsumer.as_asgi()),
]

# Get the Django ASGI application
django_asgi_app = get_asgi_application()

# ASGI application
application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": JWTAuthMiddlewareStack(
        URLRouter(websocket_urlpatterns)
    ),
})
