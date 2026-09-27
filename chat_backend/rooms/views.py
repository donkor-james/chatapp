import json
from .serializers import RoomMessageSerializer
from .models import RoomMessage
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.db import transaction
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from django.core.serializers.json import DjangoJSONEncoder
from .models import Room, RoomMembership, DirectMessage, RoomInvite
from .serializers import (
    RoomSerializer, CreateRoomSerializer,
    DirectMessageSerializer, SendDirectMessageSerializer,
)
from notifications.models import Notification

channel_layer = get_channel_layer()


def _broadcast_room_event(room_id: str, event: dict):
    async_to_sync(channel_layer.group_send)(f'room_{room_id}', event)


def _notify_user(user_id, notification):
    async_to_sync(channel_layer.group_send)(
        f'notifications_{user_id}',
        {
            'type': 'notification_message',
            'notification': notification,
        },
    )


class RoomListView(generics.ListAPIView):
    """Active rooms the requesting user is a member of."""
    serializer_class = RoomSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Room.objects.filter(
            memberships__user=self.request.user,
            memberships__is_active=True,
        ).exclude(status=Room.Status.ENDED).prefetch_related(
            'memberships__user'
        ).select_related('host')


class CreateRoomView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        serializer = CreateRoomSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        room = Room.objects.create(
            topic=data['topic'],
            description=data.get('description', ''),
            host=request.user,
            status=Room.Status.ACTIVE,
        )
        # Host is always a member
        RoomMembership.objects.create(
            room=room, user=request.user, role=RoomMembership.Role.HOST
        )

        # Send direct invites to listed followers
        invite_ids = data.get('invite_user_ids', [])
        if invite_ids:
            self._send_invites(room, request.user, invite_ids)

        return Response(
            RoomSerializer(room, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    def _send_invites(self, room, inviter, user_ids):
        from accounts.models import User

        users = User.objects.filter(id__in=user_ids)
        for user in users:
            invite, created = RoomInvite.objects.get_or_create(
                room=room, invited_user=user,
                defaults={'invited_by': inviter},
            )
            if not created:
                continue

            notif = Notification.objects.create(
                recipient=user,
                sender=inviter,
                notification_type='chat_invite',
                title=f'{inviter.username} invited you to "{room.topic}"',
                message=f'Join the room and chat with others.',
                data={'room_id': str(room.id),
                      'invite_token': room.invite_token},
            )
            _notify_user(user.id, {
                'id': str(notif.id),
                'title': notif.title,
                'message': notif.message,
                'notification_type': notif.notification_type,
                'data': notif.data,
                'created_at': notif.created_at.isoformat(),
                'sender': {
                    'id': str(inviter.id),
                    'username': inviter.username,
                    'first_name': inviter.first_name,
                    'last_name': inviter.last_name,
                },
            })


class JoinRoomViaLinkView(APIView):
    """Join a room using its public invite token (the shareable link)."""
    permission_classes = [IsAuthenticated]

    def post(self, request, invite_token):
        room = get_object_or_404(Room, invite_token=invite_token)

        if room.status == Room.Status.ENDED:
            return Response(
                {'error': 'This room has ended.'},
                status=status.HTTP_410_GONE,
            )

        membership, created = RoomMembership.objects.get_or_create(
            room=room,
            user=request.user,
            defaults={'role': RoomMembership.Role.MEMBER, 'is_active': True},
        )
        if not created:
            # Rejoin
            membership.is_active = True
            membership.left_at = None
            membership.save(update_fields=['is_active', 'left_at'])

        if room.status == Room.Status.WAITING:
            room.status = Room.Status.ACTIVE
            room.save(update_fields=['status'])

        _broadcast_room_event(str(room.id), {
            'type': 'member_joined',
            'user': {
                'id': str(request.user.id),
                'username': request.user.username,
                'first_name': request.user.first_name,
                'last_name': request.user.last_name,
            },
        })

        return Response(
            RoomSerializer(room, context={'request': request}).data,
            status=status.HTTP_200_OK,
        )


class LeaveRoomView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, room_id):
        room = get_object_or_404(Room, id=room_id)
        membership = get_object_or_404(
            RoomMembership, room=room, user=request.user, is_active=True
        )
        membership.leave()

        _broadcast_room_event(str(room.id), {
            'type': 'member_left',
            'user_id': str(request.user.id),
        })

        # End room if no active members remain
        if not room.memberships.filter(is_active=True).exists():
            room.end()
            _broadcast_room_event(str(room.id), {'type': 'room_ended'})

        return Response({'message': 'Left room.'}, status=status.HTTP_200_OK)


class EndRoomView(APIView):
    """Host-only: forcefully end the room."""
    permission_classes = [IsAuthenticated]

    def post(self, request, room_id):
        room = get_object_or_404(Room, id=room_id, host=request.user)

        if room.status == Room.Status.ENDED:
            return Response(
                {'error': 'Room already ended.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        room.end()
        room.memberships.filter(is_active=True).update(
            is_active=False, left_at=timezone.now()
        )

        _broadcast_room_event(str(room.id), {'type': 'room_ended'})

        return Response({'message': 'Room ended.'}, status=status.HTTP_200_OK)


class RoomMessageListView(generics.ListAPIView):
    """GET /api/rooms/<room_id>/messages/"""
    serializer_class = RoomMessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        room = get_object_or_404(Room, id=self.kwargs['room_id'])
        if not room.memberships.filter(user=self.request.user, is_active=True).exists():
            return RoomMessage.objects.none()
        return RoomMessage.objects.filter(room=room).select_related('sender')


class SendRoomMessageView(APIView):
    """POST /api/rooms/<room_id>/messages/"""
    permission_classes = [IsAuthenticated]

    def post(self, request, room_id):
        room = get_object_or_404(Room, id=room_id)

        if not room.memberships.filter(user=request.user, is_active=True).exists():
            return Response(
                {'error': 'You are not an active member of this room.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        content = request.data.get('content', '').strip()
        if not content:
            return Response(
                {'error': 'Message content cannot be empty.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        message = RoomMessage.objects.create(
            room=room, sender=request.user, content=content
        )

        message_data = RoomMessageSerializer(message).data

        # Convert to plain dict so json.dumps in the consumer can handle it
        from rest_framework.renderers import JSONRenderer
        import json
        message_dict = json.loads(JSONRenderer().render(message_data))

        # Broadcast to everyone in the room via WebSocket
        async_to_sync(channel_layer.group_send)(
            f'room_{room_id}',
            {
                'type': 'room_message',
                'message': message_dict,
            }
        )

        return Response(message_data, status=status.HTTP_201_CREATED)


class RoomMessageDetailView(APIView):
    """PATCH /api/rooms/<room_id>/messages/<message_id>/ — edit
       DELETE /api/rooms/<room_id>/messages/<message_id>/ — delete"""
    permission_classes = [IsAuthenticated]

    def get_object(self, room_id, message_id, user):
        msg = get_object_or_404(RoomMessage, id=message_id, room_id=room_id)
        if msg.sender != user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied
        return msg

    def patch(self, request, room_id, message_id):
        msg = self.get_object(room_id, message_id, request.user)
        content = request.data.get('content', '').strip()
        if not content:
            return Response({'error': 'Content cannot be empty.'}, status=status.HTTP_400_BAD_REQUEST)
        msg.content = content
        msg.is_edited = True
        msg.save(update_fields=['content', 'is_edited'])

        message_data = json.loads(json.dumps(
            dict(RoomMessageSerializer(msg).data), cls=DjangoJSONEncoder))
        async_to_sync(channel_layer.group_send)(
            f'room_{room_id}',
            {'type': 'room_message_updated', 'message': message_data}
        )
        return Response(message_data)

    def delete(self, request, room_id, message_id):
        msg = self.get_object(room_id, message_id, request.user)
        msg.is_deleted = True
        msg.content = ''
        msg.save(update_fields=['is_deleted', 'content'])

        message_data = json.loads(json.dumps(
            dict(RoomMessageSerializer(msg).data), cls=DjangoJSONEncoder))

        async_to_sync(channel_layer.group_send)(
            f'room_{room_id}',
            {'type': 'room_message_deleted', 'message': message_data}
        )
        return Response(status=status.HTTP_200_OK)


class RoomDetailView(generics.RetrieveAPIView):
    serializer_class = RoomSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'id'

    def get_queryset(self):
        return Room.objects.prefetch_related('memberships__user').select_related('host')


class DirectMessageListView(generics.ListAPIView):
    """
    GET /api/rooms/<room_id>/dm/<user_id>/
    Retrieve the DM thread between the requesting user and another member in this room.
    """
    serializer_class = DirectMessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        room_id = self.kwargs['room_id']
        other_user_id = self.kwargs['user_id']
        user = self.request.user

        # Ensure both users are active members
        room = get_object_or_404(Room, id=room_id)
        if not room.memberships.filter(user=user, is_active=True).exists():
            return DirectMessage.objects.none()

        from django.db.models import Q
        qs = DirectMessage.objects.filter(
            room_id=room_id
        ).filter(
            Q(sender=user, recipient_id=other_user_id) |
            Q(sender_id=other_user_id, recipient=user)
        ).select_related('sender', 'recipient')

        # Mark incoming as read
        qs.filter(recipient=user, read_at__isnull=True).update(
            read_at=timezone.now()
        )
        return qs


class StartDMFromRoomView(APIView):
    """
    POST /api/rooms/<room_id>/dm-with/<user_id>/

    Called when a user clicks "Message" on another room member.
    Creates or retrieves a DirectConversation and returns it.
    The client then navigates to /conversations/<id>/ — completely outside the room.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, room_id, user_id):
        from accounts.models import User
        from conversations.models import DirectConversation

        room = get_object_or_404(Room, id=room_id)

        # Both users must be active members of the room to initiate
        requester_active = room.memberships.filter(
            user=request.user, is_active=True).exists()
        target_active = room.memberships.filter(
            user_id=user_id, is_active=True).exists()

        if not requester_active or not target_active:
            return Response(
                {'error': 'Both users must be active members of this room.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        other_user = get_object_or_404(User, id=user_id)
        conversation, _ = DirectConversation.get_or_create_for(
            request.user, other_user)

        from conversations.serializers import DirectConversationSerializer
        return Response(
            DirectConversationSerializer(conversation, context={
                                         'request': request}).data,
            status=status.HTTP_200_OK,
        )


def _dm_channel_name(room_id: str, user_a: str, user_b: str) -> str:
    """Deterministic channel name for a DM pair within a room."""
    pair = '_'.join(sorted([user_a, user_b]))
    return f'dm_{room_id}_{pair}'
