from conversations.consumers import ConversationConsumer
from rooms.consumers import RoomConsumer
from notifications.consumers import NotificationConsumer
from accounts.jwt_channels_middleware import JWTAuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from django.urls import re_path
from django.core.asgi import get_asgi_application
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'chat_backend.settings')
django.setup()


websocket_urlpatterns = [
    re_path(r'^ws/rooms/(?P<room_id>[0-9a-f-]+)/$', RoomConsumer.as_asgi()),
    re_path(
        r'^ws/conversations/(?P<conversation_id>[0-9a-f-]+)/$', ConversationConsumer.as_asgi()),
    re_path(r'^ws/notifications/$', NotificationConsumer.as_asgi()),
]

application = ProtocolTypeRouter({
    'http': get_asgi_application(),
    'websocket': JWTAuthMiddlewareStack(URLRouter(websocket_urlpatterns)),
})
