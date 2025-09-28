import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

logger = logging.getLogger(__name__)


class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        """Handle WebSocket connection"""
        try:
            from django.contrib.auth.models import AnonymousUser
            self.user = self.scope.get('user')
            logger.info(
                f"NotificationConsumer connect attempt - User: {self.user}")

            # Check authentication
            if not self.user or isinstance(self.user, AnonymousUser) or not self.user.is_authenticated:
                logger.warning(
                    "Unauthenticated user attempting to connect to notifications")
                # Custom close code for auth failure
                await self.close(code=4001)
                return

            self.notification_group_name = f'notifications_{self.user.id}'
            logger.info(
                f"User {self.user.username} joining notification group: {self.notification_group_name}")

            # Join notification group
            await self.channel_layer.group_add(
                self.notification_group_name,
                self.channel_name
            )

            await self.accept()
            logger.info(
                f"NotificationConsumer: WebSocket connection accepted for user {self.user.username}")

        except Exception as e:
            logger.error(f"Error in NotificationConsumer.connect: {str(e)}")
            await self.close(code=4000)  # Generic error

    async def disconnect(self, close_code):
        """Handle WebSocket disconnection"""
        try:
            logger.info(
                f"NotificationConsumer disconnect - Code: {close_code}, User: {getattr(self, 'user', 'Unknown')}")

            group_name = getattr(self, 'notification_group_name', None)
            if group_name:
                await self.channel_layer.group_discard(
                    group_name,
                    self.channel_name
                )
                logger.info(f"Removed from group: {group_name}")

        except Exception as e:
            logger.error(f"Error in NotificationConsumer.disconnect: {str(e)}")

    async def receive(self, text_data):
        """Handle incoming WebSocket messages"""
        try:
            data = json.loads(text_data)
            message_type = data.get('type')

            logger.info(
                f"NotificationConsumer received message: {message_type}")

            if message_type == 'mark_read':
                notification_id = data.get('notification_id')
                if notification_id:
                    await self.mark_notification_read(notification_id)
            else:
                logger.warning(f"Unknown message type: {message_type}")

        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON received: {str(e)}")
            await self.send_error("Invalid JSON format")
        except Exception as e:
            logger.error(f"Error in NotificationConsumer.receive: {str(e)}")

    async def notification_message(self, event):
        """Send notification to client"""
        try:
            await self.send(text_data=json.dumps({
                'type': 'notification',
                'notification': event['notification']
            }))
            logger.info(f"Sent notification to user {self.user.username}")
        except Exception as e:
            logger.error(f"Error sending notification: {str(e)}")

    async def send_error(self, message):
        """Send error message to client"""
        try:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': message
            }))
        except Exception as e:
            logger.error(f"Error sending error message: {str(e)}")

    @database_sync_to_async
    def mark_notification_read(self, notification_id):
        """Mark notification as read"""
        try:
            from notifications.models import Notification
            notification = Notification.objects.get(
                id=notification_id,
                recipient=self.user
            )
            notification.is_read = True
            notification.save()
            logger.info(
                f"Marked notification {notification_id} as read for user {self.user.username}")
        except Exception as e:
            logger.error(f"Error marking notification as read: {str(e)}")
