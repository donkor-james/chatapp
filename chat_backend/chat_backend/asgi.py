
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'chat_backend.settings')
from django.urls import path
from notifications.consumers import NotificationConsumer
from chats.consumers import ChatConsumer
from accounts.jwt_channels_middleware import JWTAuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application


websocket_urlpatterns = [
    path('ws/chat/<int:chat_id>/', ChatConsumer.as_asgi()),
    path('ws/notifications/', NotificationConsumer.as_asgi()),
]

application = ProtocolTypeRouter({
    'http': get_asgi_application(),
    'websocket': JWTAuthMiddlewareStack(
        URLRouter(websocket_urlpatterns)
    ),
})
