import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone

logger = logging.getLogger(__name__)


def _dm_channel_name(room_id: str, user_a: str, user_b: str) -> str:
    pair = '_'.join(sorted([user_a, user_b]))
    return f'dm_{room_id}_{pair}'


class RoomConsumer(AsyncWebsocketConsumer):
    """
    WebSocket for a room's broadcast channel.
    Handles: join/leave events, typing indicators, room-wide system messages.
    DMs travel through DM channels, not here.
    """

    async def connect(self):
        from django.contrib.auth.models import AnonymousUser

        self.user = self.scope.get('user')
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.room_group = f'room_{self.room_id}'

        if not self.user or isinstance(self.user, AnonymousUser) or not self.user.is_authenticated:
            await self.close(code=4001)
            return

        is_member = await self._is_active_member()
        if not is_member:
            await self.close(code=4003)
            return

        await self.channel_layer.group_add(self.room_group, self.channel_name)
        await self.accept()

        logger.info(
            f'RoomConsumer: {self.user.username} connected to room {self.room_id}')

        await self.channel_layer.group_send(
            self.room_group,
            {
                'type': 'user_status',
                'user_id': str(self.user.id),
                'status': 'online',
            },
        )

    async def disconnect(self, close_code):
        if hasattr(self, 'room_group'):
            await self.channel_layer.group_send(
                self.room_group,
                {
                    'type': 'user_status',
                    'user_id': str(self.user.id),
                    'status': 'offline',
                },
            )
            await self.channel_layer.group_discard(self.room_group, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            await self._send_error('Invalid JSON.')
            return

        msg_type = data.get('type')
        if msg_type == 'typing':
            await self._handle_typing(data)
        else:
            await self._send_error(f'Unknown type: {msg_type}')

    async def _handle_typing(self, data):
        await self.channel_layer.group_send(
            self.room_group,
            {
                'type': 'typing_status',
                'user_id': str(self.user.id),
                'username': self.user.username,
                'is_typing': bool(data.get('is_typing', False)),
            },
        )

    # ── Group event handlers ──────────────────────────────────────────────────

    async def room_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'message',
            'message': event['message'],
        }))

    async def room_message_updated(self, event):
        await self.send(text_data=json.dumps({
            'type': 'message_updated',
            'message': event['message'],
        }))

    async def room_message_deleted(self, event):
        await self.send(text_data=json.dumps({
            'type': 'message_deleted',
            'message': event['message'],
        }))

    async def member_joined(self, event):
        await self.send(text_data=json.dumps({'type': 'member_joined', 'user': event['user']}))

    async def member_left(self, event):
        await self.send(text_data=json.dumps({'type': 'member_left', 'user_id': event['user_id']}))

    async def room_ended(self, event):
        await self.send(text_data=json.dumps({'type': 'room_ended'}))
        await self.close()

    async def typing_status(self, event):
        if event['user_id'] != str(self.user.id):
            await self.send(text_data=json.dumps({
                'type': 'typing',
                'user_id': event['user_id'],
                'username': event['username'],
                'is_typing': event['is_typing'],
            }))

    async def user_status(self, event):
        if event['user_id'] != str(self.user.id):
            await self.send(text_data=json.dumps({
                'type': 'user_status',
                'user_id': event['user_id'],
                'status': event['status'],
            }))

    async def _send_error(self, message):
        await self.send(text_data=json.dumps({'type': 'error', 'message': message}))

    @database_sync_to_async
    def _is_active_member(self):
        from rooms.models import RoomMembership
        return RoomMembership.objects.filter(
            room_id=self.room_id,
            user=self.user,
            is_active=True,
        ).exists()


class DMConsumer(AsyncWebsocketConsumer):
    """
    WebSocket for private DMs between two room members.
    URL: ws/rooms/<room_id>/dm/<other_user_id>/
    Each end subscribes to the same deterministic group name.
    """

    async def connect(self):
        from django.contrib.auth.models import AnonymousUser

        self.user = self.scope.get('user')
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.other_user_id = self.scope['url_route']['kwargs']['other_user_id']

        if not self.user or isinstance(self.user, AnonymousUser) or not self.user.is_authenticated:
            await self.close(code=4001)
            return

        both_active = await self._both_members_active()
        if not both_active:
            await self.close(code=4003)
            return

        self.dm_group = _dm_channel_name(
            self.room_id, str(self.user.id), self.other_user_id
        )
        await self.channel_layer.group_add(self.dm_group, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'dm_group'):
            await self.channel_layer.group_discard(self.dm_group, self.channel_name)

    async def receive(self, text_data):
        """
        Clients send DMs via the REST API (POST /api/rooms/<id>/dm/).
        This consumer is receive-only for push delivery.
        """
        pass

    async def direct_message(self, event):
        await self.send(text_data=json.dumps({'type': 'dm', 'dm': event['dm']}))

    @database_sync_to_async
    def _both_members_active(self):
        from rooms.models import RoomMembership
        count = RoomMembership.objects.filter(
            room_id=self.room_id,
            is_active=True,
            user_id__in=[str(self.user.id), self.other_user_id],
        ).count()
        return count == 2
