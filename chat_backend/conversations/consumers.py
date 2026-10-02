import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

logger = logging.getLogger(__name__)


class ConversationConsumer(AsyncWebsocketConsumer):
    """
    ws/conversations/<conversation_id>/

    Both participants connect to the same group.
    The consumer is receive-only for push delivery — messages are sent
    via the REST API which then broadcasts here.
    Typing indicators are the one exception: they're sent directly over
    the socket since they're ephemeral and don't need to be persisted.
    """

    async def connect(self):
        from django.contrib.auth.models import AnonymousUser

        self.user = self.scope.get('user')
        self.conversation_id = self.scope['url_route']['kwargs']['conversation_id']

        if not self.user or isinstance(self.user, AnonymousUser) or not self.user.is_authenticated:
            await self.close(code=4001)
            return

        is_participant = await self._is_participant()
        if not is_participant:
            await self.close(code=4003)
            return

        self.group_name = f'conversation_{self.conversation_id}'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        logger.info(
            f'ConversationConsumer: {self.user.username} connected to {self.conversation_id}')

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            await self._send_error('Invalid JSON.')
            return

        if data.get('type') == 'typing':
            await self._handle_typing(data)

    async def _handle_typing(self, data):
        await self.channel_layer.group_send(
            self.group_name,
            {
                'type': 'typing_status',
                'user_id': str(self.user.id),
                'username': self.user.username,
                'is_typing': bool(data.get('is_typing', False)),
            },
        )

    async def new_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'message',
            'message': event['message'],
        }))

    async def message_updated(self, event):
        await self.send(text_data=json.dumps({
            'type': 'message_updated',
            'message': event['message'],
        }))

    async def message_deleted(self, event):
        await self.send(text_data=json.dumps({
            'type': 'message_deleted',
            'message': event['message'],
        }))

    async def typing_status(self, event):
        # Don't echo back to the sender
        if event['user_id'] != str(self.user.id):
            await self.send(text_data=json.dumps({
                'type': 'typing',
                'user_id': event['user_id'],
                'username': event['username'],
                'is_typing': event['is_typing'],
            }))

    async def _send_error(self, message):
        await self.send(text_data=json.dumps({'type': 'error', 'message': message}))

    @database_sync_to_async
    def _is_participant(self):
        from conversations.models import DirectConversation
        from django.db.models import Q
        return DirectConversation.objects.filter(
            id=self.conversation_id,
        ).filter(
            Q(participant_a=self.user) | Q(participant_b=self.user)
        ).exists()
