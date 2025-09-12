from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from .models import Message, MessageRead
from .serializers import MessageSerializer


class MessageDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Get, update, or delete a specific message"""
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Message.objects.filter(chat__members=self.request.user)

    def perform_update(self, serializer):
        message = serializer.save(is_edited=True)

        # Send real-time update via WebSocket
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'chat_{message.chat.id}',
            {
                'type': 'message_updated',
                'message': {
                    'id': str(message.id),
                    'content': message.content,
                    'is_edited': message.is_edited,
                    'updated_at': message.updated_at.isoformat(),
                }
            }
        )

    def perform_destroy(self, instance):
        chat_id = instance.chat.id
        message_id = str(instance.id)

        instance.delete()

        # Send real-time deletion via WebSocket
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'chat_{chat_id}',
            {
                'type': 'message_deleted',
                'message_id': message_id
            }
        )
