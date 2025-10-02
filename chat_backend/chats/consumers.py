import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
# Do not import models at the top level


logger = logging.getLogger(__name__)


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        """Handle WebSocket connection"""
        try:
            # Import models here to avoid circular imports
            from .models import ChatMembership

            self.chat_id = self.scope['url_route']['kwargs']['chat_id']
            self.chat_group_name = f'chat_{self.chat_id}'
            self.user = self.scope.get('user')

            logger.info(
                f"ChatConsumer connect - User: {self.user}, Chat: {self.chat_id}")

            # Check authentication
            if not self.user or not self.user.is_authenticated:
                logger.warning(
                    f"Unauthenticated user attempting to connect to chat {self.chat_id}")
                await self.close(code=4001)
                return

            # Check chat membership
            is_member = await self.is_chat_member()
            if not is_member:
                logger.warning(
                    f"User {self.user.username} is not a member of chat {self.chat_id}")
                await self.close(code=4003)  # Forbidden
                return

            # Join chat group
            await self.channel_layer.group_add(
                self.chat_group_name,
                self.channel_name
            )

            await self.accept()
            logger.info(
                f"ChatConsumer: User {self.user.username} connected to chat {self.chat_id}")

            # Send user online status
            await self.channel_layer.group_send(
                self.chat_group_name,
                {
                    'type': 'user_status',
                    'user_id': str(self.user.id),
                    'status': 'online'
                }
            )

        except Exception as e:
            logger.error(f"Error in ChatConsumer.connect: {str(e)}")
            await self.close(code=4000)

    async def disconnect(self, close_code):
        """Handle WebSocket disconnection"""
        try:
            logger.info(f"ChatConsumer disconnect - Code: {close_code}")

            # Only send offline status if user and group are properly set
            if (hasattr(self, 'user') and
                hasattr(self.user, 'id') and
                    hasattr(self, 'chat_group_name')):

                await self.channel_layer.group_send(
                    self.chat_group_name,
                    {
                        'type': 'user_status',
                        'user_id': str(self.user.id),
                        'status': 'offline'
                    }
                )

                # Leave chat group
                await self.channel_layer.group_discard(
                    self.chat_group_name,
                    self.channel_name
                )

        except Exception as e:
            logger.error(f"Error in ChatConsumer.disconnect: {str(e)}")

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
        logger.info(
            f"User {self.user.username} sending message: {content[:50]}")

        if not content:
            await self.send_error("Message content cannot be empty")
            return

        # Save message to database
        message = await self.save_message(content, data.get('reply_to'))
        if not message:
            await self.send_error("Failed to save message")
            return

        message_dict = await self.message_to_dict(message)
        logger.info(f"Broadcasting message to group {self.chat_group_name}")

        # Send message to chat group (for active chat windows)
        await self.channel_layer.group_send(
            self.chat_group_name,
            {
                'type': 'chat_message',
                'message': message_dict
            }
        )

        # Send message to all chat members' user chat groups (for chat list updates)
        await self.send_to_user_chat_groups(message, message_dict)

        # Send notifications to offline members
        # await self.send_message_notifications(message)

    async def handle_typing(self, data):
        is_typing = data.get('is_typing', False)

        # Send typing status to others in chat
        await self.channel_layer.group_send(
            self.chat_group_name,
            {
                'type': 'typing_status',
                'user_id': str(self.user.id),
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
        logger.info(
            f"Broadcasting message to user {self.user.username}: {event['message']['content'][:50]}")
        await self.send(text_data=json.dumps({
            'type': 'message',
            'message': event['message']
        }))

    async def typing_status(self, event):
        # Don't send typing status to the user who is typing
        if event['user_id'] != self.user.id:
            await self.send(text_data=json.dumps({
                'type': 'typing',
                'user_id': str(event['user_id']),
                'username': event['username'],
                'is_typing': event['is_typing']
            }))

    async def user_status(self, event):
        # Don't send status to the user themselves
        if event['user_id'] != self.user.id:
            await self.send(text_data=json.dumps({
                'type': 'user_status',
                'user_id': str(event['user_id']),
                'status': event['status']
            }))

    async def send_error(self, message):
        await self.send(text_data=json.dumps({
            'type': 'error',
            'message': message
        }))

    @database_sync_to_async
    def is_chat_member(self):
        """Check if user is a member of the chat"""
        try:
            from .models import ChatMembership
            return ChatMembership.objects.filter(
                chat_id=self.chat_id,
                user=self.user
            ).exists()
        except Exception as e:
            logger.error(f"Error checking chat membership: {str(e)}")
            return False

    @database_sync_to_async
    def message_to_dict(self, message):
        """Convert message to dictionary with proper UUID serialization"""
        return {
            'id': str(message.id),  # Convert UUID to string
            'content': message.content,
            'chat_id': str(message.chat.id),  # Convert UUID to string
            'sender': {
                'id': str(message.sender.id),  # Convert UUID to string
                'username': message.sender.username,
                'first_name': message.sender.first_name,
                'last_name': message.sender.last_name,
            },
            'created_at': message.created_at.isoformat(),
            'reply_to': {
                'id': str(message.reply_to.id),  # Convert UUID to string
                'content': message.reply_to.content[:100],
                'sender': message.reply_to.sender.username,
            } if message.reply_to else None
        }

    # Also fix your save_message method to handle UUIDs properly
    @database_sync_to_async
    def save_message(self, content, reply_to_id=None):
        """Save message with proper UUID handling"""
        from .models import Chat
        from chat_messages.models import Message
        try:
            chat = Chat.objects.get(id=self.chat_id)
            reply_to = None

            if reply_to_id:
                # Make sure reply_to_id is properly handled as UUID
                reply_to = Message.objects.get(id=reply_to_id, chat=chat)

            message = Message.objects.create(
                chat=chat,
                sender=self.user,
                content=content,
                reply_to=reply_to
            )
            return message
        except Exception as e:
            # Log the error for debugging
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error saving message: {str(e)}")
            return None

    # Also update your notification creation to handle UUIDs
    @database_sync_to_async
    def send_message_notifications(self, message):
        """Send notifications with proper UUID serialization"""
        from .models import ChatMembership
        from notifications.models import Notification

        try:
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
                        # Convert UUID to string
                        'chat_id': str(message.chat.id),
                        # Convert UUID to string
                        'message_id': str(message.id)
                    }
                )
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error sending notifications: {str(e)}")

    # If you have any other methods that handle UUIDs, make sure to convert them to strings
    @database_sync_to_async
    def mark_message_read(self, message_id):
        """Mark message as read with proper UUID handling"""
        from chat_messages.models import Message, MessageRead
        try:
            message = Message.objects.get(id=message_id)
            MessageRead.objects.get_or_create(message=message, user=self.user)
        except Message.DoesNotExist:
            pass
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error marking message as read: {str(e)}")

    async def send_to_user_chat_groups(self, message, message_dict):
        """Send message to all chat members' user chat groups for chat list updates"""
        try:
            # Get all members of this chat
            members = await self.get_chat_members(message.chat.id)

            for member_id in members:
                user_group = f'user_chats_{member_id}'
                await self.channel_layer.group_send(
                    user_group,
                    {
                        'type': 'chat_message',
                        'message': message_dict
                    }
                )

        except Exception as e:
            logger.error(f"Error sending to user chat groups: {str(e)}")

    @database_sync_to_async
    def get_chat_members(self, chat_id):
        """Get list of all member IDs for a chat"""
        try:
            from .models import ChatMembership
            return list(
                ChatMembership.objects.filter(chat_id=chat_id)
                .values_list('user_id', flat=True)
            )
        except Exception as e:
            logger.error(f"Error getting chat members: {str(e)}")
            return []
