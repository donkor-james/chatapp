from rest_framework import status, generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.db.models import Q, Prefetch
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from .models import Chat, ChatMembership
from .serializers import ChatSerializer, CreateChatSerializer
from chat_messages.models import Message
from chat_messages.serializers import MessageSerializer, CreateMessageSerializer
from notifications.models import Notification

channel_layer = get_channel_layer()


class ChatListView(generics.ListAPIView):
    """Get user's chats"""
    serializer_class = ChatSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Chat.objects.filter(
            members=self.request.user,
            is_active=True
        ).prefetch_related(
            'members',
            'messages',
            'chatmembership_set__user'
        ).order_by('-updated_at')


class CreateChatView(APIView):
    """Create a new chat"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CreateChatSerializer(data=request.data)
        if serializer.is_valid():
            validated_data = serializer.validated_data
            chat_type = validated_data['chat_type']
            member_ids = validated_data['member_ids']

            # For private chats, check if chat already exists
            if chat_type == 'private':
                other_user_id = member_ids[0]
                existing_chat = Chat.objects.filter(
                    chat_type='private',
                    members=request.user
                ).filter(members__id=other_user_id).first()

                if existing_chat:
                    return Response(
                        ChatSerializer(existing_chat, context={
                                       'request': request}).data,
                        status=status.HTTP_200_OK
                    )

            # Create new chat
            chat = Chat.objects.create(
                name=validated_data.get('name', ''),
                chat_type=chat_type,
                created_by=request.user
            )

            # Add creator as owner/member
            ChatMembership.objects.create(
                chat=chat,
                user=request.user,
                role='owner' if chat_type == 'group' else 'member'
            )

            # Add other members
            for user_id in member_ids:
                ChatMembership.objects.create(
                    chat=chat,
                    user_id=user_id,
                    role='member'
                )

            return Response(
                ChatSerializer(chat, context={'request': request}).data,
                status=status.HTTP_201_CREATED
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ChatDetailView(generics.RetrieveAPIView):
    """Get chat details"""
    serializer_class = ChatSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Chat.objects.filter(members=self.request.user)


class ChatMessagesView(generics.ListCreateAPIView):
    """Get chat messages and send new messages"""
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        chat_id = self.kwargs['chat_id']
        chat = get_object_or_404(Chat, id=chat_id, members=self.request.user)
        return Message.objects.filter(chat=chat).select_related('sender', 'reply_to__sender')

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CreateMessageSerializer
        return MessageSerializer

    def perform_create(self, serializer):
        chat_id = self.kwargs['chat_id']
        chat = get_object_or_404(Chat, id=chat_id, members=self.request.user)

        message = serializer.save(chat=chat, sender=self.request.user)

        # Send real-time message via WebSocket
        async_to_sync(channel_layer.group_send)(
            f'chat_{chat_id}',
            {
                'type': 'chat_message',
                'message': {
                    'id': str(message.id),
                    'content': message.content,
                    'sender': {
                        'id': message.sender.id,
                        'username': message.sender.username,
                        'first_name': message.sender.first_name,
                        'last_name': message.sender.last_name,
                    },
                    'created_at': message.created_at.isoformat(),
                    'message_type': message.message_type,
                    'reply_to': {
                        'id': str(message.reply_to.id),
                        'content': message.reply_to.content[:100],
                        'sender': message.reply_to.sender.username,
                    } if message.reply_to else None
                }
            }
        )

        # Send notifications to chat members
        self.send_message_notifications(message)

    def send_message_notifications(self, message):
        """Send notifications to chat members"""
        members = ChatMembership.objects.filter(
            chat=message.chat
        ).exclude(user=message.sender).select_related('user')

        for membership in members:
            # Create notification
            notification = Notification.objects.create(
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

            # Send real-time notification
            async_to_sync(channel_layer.group_send)(
                f'notifications_{membership.user.id}',
                {
                    'type': 'notification_message',
                    'notification': {
                        'id': str(notification.id),
                        'title': notification.title,
                        'message': notification.message,
                        'notification_type': notification.notification_type,
                        'data': notification.data,
                        'created_at': notification.created_at.isoformat(),
                        'sender': {
                            'id': message.sender.id,
                            'username': message.sender.username,
                            'first_name': message.sender.first_name,
                            'last_name': message.sender.last_name,
                        }
                    }
                }
            )


class MarkMessageReadView(APIView):
    """Mark message as read"""
    permission_classes = [IsAuthenticated]

    def post(self, request, chat_id, message_id):
        chat = get_object_or_404(Chat, id=chat_id, members=request.user)
        message = get_object_or_404(Message, id=message_id, chat=chat)

        from messages.models import MessageRead
        MessageRead.objects.get_or_create(message=message, user=request.user)

        return Response({'message': 'Message marked as read'}, status=status.HTTP_200_OK)
