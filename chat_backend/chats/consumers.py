import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
# Do not import models at the top level


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Import models only after settings are loaded
        from .models import Chat, ChatMembership
        from chat_messages.models import Message
        from notifications.models import Notification
        self.chat_id = self.scope['url_route']['kwargs']['chat_id']
        self.chat_group_name = f'chat_{self.chat_id}'
        self.user = self.scope['user']

        print("[ChatConsumer.connect] user:", self.user)
        print("[ChatConsumer.connect] chat_id:", self.chat_id)

        # Check if user is authenticated and member of chat
        if not self.user.is_authenticated:
            print("[ChatConsumer.connect] user not authenticated, closing.")
            await self.close()
            return

        is_member = await self.is_chat_member()
        print(f"[ChatConsumer.connect] is_member: {is_member}")
        if not is_member:
            print("[ChatConsumer.connect] user is not a member of chat, closing.")
            await self.close()
            return

        # Join chat group
        await self.channel_layer.group_add(
            self.chat_group_name,
            self.channel_name
        )

        await self.accept()

        # Send user online status
        await self.channel_layer.group_send(
            self.chat_group_name,
            {
                'type': 'user_status',
                'user_id': self.user.id,
                'status': 'online'
            }
        )

    async def disconnect(self, close_code):
        # Send user offline status
        await self.channel_layer.group_send(
            self.chat_group_name,
            {
                'type': 'user_status',
                'user_id': self.user.id,
                'status': 'offline'
            }
        )

        # Leave chat group
        await self.channel_layer.group_discard(
            self.chat_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        try:
            text_data_json = json.loads(text_data)
            message_type = text_data_json.get('type', 'message')

            if message_type == 'message':
                await self.handle_message(text_data_json)
            elif message_type == 'typing':
                await self.handle_typing(text_data_json)
            elif message_type == 'message_read':
                await self.handle_message_read(text_data_json)

        except json.JSONDecodeError:
            await self.send_error("Invalid JSON")

    async def handle_message(self, data):
        content = data.get('content', '').strip()
        if not content:
            await self.send_error("Message content cannot be empty")
            return

        # Save message to database
        message = await self.save_message(content, data.get('reply_to'))
        if not message:
            await self.send_error("Failed to save message")
            return

        # Send message to chat group
        await self.channel_layer.group_send(
            self.chat_group_name,
            {
                'type': 'chat_message',
                'message': await self.message_to_dict(message)
            }
        )

        # Send notifications to offline members
        await self.send_message_notifications(message)

    async def handle_typing(self, data):
        is_typing = data.get('is_typing', False)

        # Send typing status to others in chat
        await self.channel_layer.group_send(
            self.chat_group_name,
            {
                'type': 'typing_status',
                'user_id': self.user.id,
                'username': self.user.username,
                'is_typing': is_typing
            }
        )

    async def handle_message_read(self, data):
        message_id = data.get('message_id')
        if message_id:
            await self.mark_message_read(message_id)

    # Receive message from chat group
    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'message',
            'message': event['message']
        }))

    async def typing_status(self, event):
        # Don't send typing status to the user who is typing
        if event['user_id'] != self.user.id:
            await self.send(text_data=json.dumps({
                'type': 'typing',
                'user_id': event['user_id'],
                'username': event['username'],
                'is_typing': event['is_typing']
            }))

    async def user_status(self, event):
        # Don't send status to the user themselves
        if event['user_id'] != self.user.id:
            await self.send(text_data=json.dumps({
                'type': 'user_status',
                'user_id': event['user_id'],
                'status': event['status']
            }))

    async def send_error(self, message):
        await self.send(text_data=json.dumps({
            'type': 'error',
            'message': message
        }))

    @database_sync_to_async
    def is_chat_member(self):
        from .models import ChatMembership
        return ChatMembership.objects.filter(chat_id=self.chat_id, user=self.user).exists()

    @database_sync_to_async
    def save_message(self, content, reply_to_id=None):
        from .models import Chat
        from chat_messages.models import Message
        try:
            chat = Chat.objects.get(id=self.chat_id)
            reply_to = None

            if reply_to_id:
                reply_to = Message.objects.get(id=reply_to_id, chat=chat)

            message = Message.objects.create(
                chat=chat,
                sender=self.user,
                content=content,
                reply_to=reply_to
            )
            return message
        except Exception:
            return None

    @database_sync_to_async
    def mark_message_read(self, message_id):
        from chat_messages.models import Message, MessageRead
        try:
            message = Message.objects.get(id=message_id)
            MessageRead.objects.get_or_create(message=message, user=self.user)
        except Message.DoesNotExist:
            pass

    @database_sync_to_async
    def message_to_dict(self, message):
        return {
            'id': str(message.id),
            'content': message.content,
            'sender': {
                'id': message.sender.id,
                'username': message.sender.username,
                'first_name': message.sender.first_name,
                'last_name': message.sender.last_name,
            },
            'created_at': message.created_at.isoformat(),
            'reply_to': {
                'id': str(message.reply_to.id),
                'content': message.reply_to.content[:100],
                'sender': message.reply_to.sender.username,
            } if message.reply_to else None
        }

    @database_sync_to_async
    def send_message_notifications(self, message):
        from .models import ChatMembership
        from notifications.models import Notification
        # Get all chat members except the sender
        members = ChatMembership.objects.filter(
            chat=message.chat
        ).exclude(user=message.sender).select_related('user')

        for membership in members:
            # Create notification for each member
            Notification.objects.create(
                recipient=membership.user,
                sender=message.sender,
                notification_type='message',
                title=f'New message from {message.sender.username}',
                message=message.content[:100],
                data={
                    'chat_id': str(message.chat.id),
                    'message_id': str(message.id)
                }
            )
