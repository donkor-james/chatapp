from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.db.models import Q
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from .models import DirectConversation, DirectMessage
from .serializers import (
    DirectConversationSerializer,
    DirectMessageSerializer,
    SendMessageSerializer,
)

channel_layer = get_channel_layer()


def _conversation_group(conversation_id: str) -> str:
    return f'conversation_{conversation_id}'


class ConversationListView(generics.ListAPIView):
    """
    GET /api/conversations/
    Returns all DM conversations for the authenticated user, most recent first.
    """
    serializer_class = DirectConversationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return DirectConversation.objects.filter(
            Q(participant_a=user) | Q(participant_b=user)
        ).select_related('participant_a', 'participant_b').prefetch_related('messages')

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx


class GetOrCreateConversationView(APIView):
    """
    POST /api/conversations/start/
    Body: { "user_id": "<uuid>" }

    Gets or creates a DM conversation with another user.
    This is the entry point — called when a room member clicks "Message" on
    another member's profile, or from anywhere else in the app.
    Returns the conversation object so the client can navigate to the chat page.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from accounts.models import User

        user_id = request.data.get('user_id')
        if not user_id:
            return Response({'error': 'user_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        if str(request.user.id) == str(user_id):
            return Response({'error': 'Cannot start a conversation with yourself.'}, status=status.HTTP_400_BAD_REQUEST)

        other_user = get_object_or_404(User, id=user_id)
        conversation, _ = DirectConversation.get_or_create_for(
            request.user, other_user)

        return Response(
            DirectConversationSerializer(conversation, context={
                                         'request': request}).data,
            status=status.HTTP_200_OK,
        )


class ConversationDetailView(generics.RetrieveAPIView):
    """GET /api/conversations/<id>/"""
    serializer_class = DirectConversationSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'id'

    def get_queryset(self):
        user = self.request.user
        return DirectConversation.objects.filter(
            Q(participant_a=user) | Q(participant_b=user)
        ).select_related('participant_a', 'participant_b')

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx


class MessageListView(generics.ListAPIView):
    """
    GET /api/conversations/<conversation_id>/messages/
    Paginates messages and marks incoming ones as read.
    """
    serializer_class = DirectMessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        conversation = get_object_or_404(
            DirectConversation,
            id=self.kwargs['conversation_id'],
        )
        self._assert_participant(conversation, user)

        # Mark all unread incoming messages as read in one query
        conversation.messages.filter(
            read_at__isnull=True
        ).exclude(sender=user).update(read_at=timezone.now())

        return conversation.messages.select_related('sender')

    def _assert_participant(self, conversation, user):
        if conversation.participant_a != user and conversation.participant_b != user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied


class SendMessageView(APIView):
    """
    POST /api/conversations/<conversation_id>/messages/
    Sends a message and pushes it via WebSocket to both participants.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, conversation_id):
        conversation = get_object_or_404(
            DirectConversation, id=conversation_id)

        if request.user not in (conversation.participant_a, conversation.participant_b):
            return Response(status=status.HTTP_403_FORBIDDEN)

        serializer = SendMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        message = DirectMessage.objects.create(
            conversation=conversation,
            sender=request.user,
            content=serializer.validated_data['content'],
        )

        # Keep last_message_at fresh for inbox ordering
        conversation.last_message_at = message.created_at
        conversation.save(update_fields=['last_message_at'])

        message_data = DirectMessageSerializer(message).data

        async_to_sync(channel_layer.group_send)(
            _conversation_group(str(conversation_id)),
            {
                'type': 'new_message',
                'message': message_data,
            },
        )

        return Response(message_data, status=status.HTTP_201_CREATED)
