import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

logger = logging.getLogger(__name__)


class UserChatsConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer that receives messages from ALL chats that the user is a member of.
    This allows updating chat lists and showing new messages even when not in the specific chat.
    """

    async def connect(self):
        """Handle WebSocket connection"""
        try:
            self.user = self.scope.get('user')

            logger.info(f"UserChatsConsumer connect - User: {self.user}")

            # Check authentication
            if not self.user or not self.user.is_authenticated:
                logger.warning(
                    "Unauthenticated user attempting to connect to user chats")
                await self.close(code=4001)
                return

            # Create group name for this user
            self.user_chats_group = f'user_chats_{self.user.id}'

            logger.info(
                f"User {self.user.username} joining user chats group: {self.user_chats_group}")

            # Join user chats group
            await self.channel_layer.group_add(
                self.user_chats_group,
                self.channel_name
            )

            await self.accept()
            logger.info(
                f"UserChatsConsumer: User {self.user.username} connected to user chats")

        except Exception as e:
            logger.error(f"Error in UserChatsConsumer.connect: {str(e)}")
            await self.close(code=4000)

    async def disconnect(self, close_code):
        """Handle WebSocket disconnection"""
        try:
            logger.info(
                f"UserChatsConsumer disconnect - Code: {close_code}, User: {getattr(self, 'user', 'Unknown')}")

            # Leave user chats group
            if hasattr(self, 'user_chats_group'):
                await self.channel_layer.group_discard(
                    self.user_chats_group,
                    self.channel_name
                )

        except Exception as e:
            logger.error(f"Error in UserChatsConsumer.disconnect: {str(e)}")

    async def receive(self, text_data):
        """Handle messages from WebSocket"""
        try:
            text_data_json = json.loads(text_data)
            message_type = text_data_json.get('type', 'message')

            if message_type == 'message':
                await self.handle_message(text_data_json)
            elif message_type == 'typing':
                await self.handle_typing(text_data_json)
            elif message_type == 'create_chat':
                await self.handle_create_chat(text_data_json)

        except json.JSONDecodeError:
            await self.send_error("Invalid JSON")
        except Exception as e:
            logger.error(f"Error in UserChatsConsumer.receive: {str(e)}")

    async def handle_message(self, data):
        """Handle sending a message to a specific chat"""
        chat_id = data.get('chat_id')
        content = data.get('content', '').strip()

        if not chat_id:
            await self.send_error("Chat ID is required")
            return

        if not content:
            await self.send_error("Message content cannot be empty")
            return

        # Check if user is member of this chat
        is_member = await self.is_chat_member(chat_id)
        if not is_member:
            await self.send_error("You are not a member of this chat")
            return

        # Save message to database
        message = await self.save_message(chat_id, content, data.get('reply_to'))
        if not message:
            await self.send_error("Failed to save message")
            return

        message_dict = await self.message_to_dict(message)

        # Send message to specific chat group (for real-time chat window updates)
        chat_group_name = f'chat_{chat_id}'
        await self.channel_layer.group_send(
            chat_group_name,
            {
                'type': 'chat_message',
                'message': message_dict
            }
        )

        # Send message to all user chat groups for chat list updates
        await self.send_to_chat_members(message, message_dict)

    async def handle_typing(self, data):
        """Handle typing indicators"""
        chat_id = data.get('chat_id')
        is_typing = data.get('is_typing', False)

        if not chat_id:
            return

        # Check if user is member of this chat
        is_member = await self.is_chat_member(chat_id)
        if not is_member:
            return

        # Send typing status to specific chat group
        chat_group_name = f'chat_{chat_id}'
        await self.channel_layer.group_send(
            chat_group_name,
            {
                'type': 'typing_status',
                'user_id': str(self.user.id),
                'username': self.user.username,
                'is_typing': is_typing
            }
        )

    # Receive message from user chats group
    async def chat_message(self, event):
        """Send message to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'message',
            'message': event['message']
        }))

    # Receive new chat notification from user chats group
    async def new_chat(self, event):
        """Send new chat notification to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'new_chat',
            'chat': event['chat']
        }))

    async def send_error(self, message):
        """Send error message to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'error',
            'message': message
        }))

    @database_sync_to_async
    def is_chat_member(self, chat_id):
        """Check if user is a member of the chat"""
        try:
            from .models import ChatMembership
            return ChatMembership.objects.filter(
                chat_id=chat_id,
                user=self.user
            ).exists()
        except Exception as e:
            logger.error(f"Error checking chat membership: {str(e)}")
            return False

    @database_sync_to_async
    def save_message(self, chat_id, content, reply_to_id=None):
        """Save message to database"""
        try:
            from .models import Chat
            from chat_messages.models import Message

            chat = Chat.objects.get(id=chat_id)
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
        except Exception as e:
            logger.error(f"Error saving message: {str(e)}")
            return None

    @database_sync_to_async
    def message_to_dict(self, message):
        """Convert message to dictionary"""
        return {
            'id': str(message.id),
            'content': message.content,
            'chat_id': str(message.chat.id),
            'sender': {
                'id': str(message.sender.id),
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
    def send_to_chat_members(self, message, message_dict):
        """Send message to all chat members' user chat groups"""
        try:
            from .models import ChatMembership
            from channels.layers import get_channel_layer
            from asgiref.sync import async_to_sync

            # Get all members of this chat
            members = ChatMembership.objects.filter(
                chat=message.chat
            ).select_related('user')

            channel_layer = get_channel_layer()

            for membership in members:
                user_group = f'user_chats_{membership.user.id}'
                async_to_sync(channel_layer.group_send)(
                    user_group,
                    {
                        'type': 'chat_message',
                        'message': message_dict
                    }
                )

        except Exception as e:
            logger.error(f"Error sending to chat members: {str(e)}")
