from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.db.models import Q
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from .models import Contact, FriendRequest, BlockedUser, User
from .serializers import ContactSerializer, FriendRequestSerializer, SendFriendRequestSerializer
from notifications.models import Notification

channel_layer = get_channel_layer()


class ContactListView(generics.ListAPIView):
    """Get user's contacts/friends"""
    serializer_class = ContactSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Contact.objects.filter(owner=self.request.user).select_related('contact_user')


class FriendRequestListView(generics.ListAPIView):
    """Get user's friend requests (sent and received)"""
    serializer_class = FriendRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        request_type = self.request.query_params.get('type', 'all')

        queryset = FriendRequest.objects.select_related('from_user', 'to_user')

        if request_type == 'sent':
            return queryset.filter(from_user=user)
        elif request_type == 'received':
            return queryset.filter(to_user=user, status='pending')
        else:
            return queryset.filter(Q(from_user=user) | Q(to_user=user))


class SendFriendRequestView(APIView):
    """Send a friend request"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = SendFriendRequestSerializer(
            data=request.data, context={'request': request})
        if serializer.is_valid():
            user_id = serializer.validated_data['user_id']
            to_user = get_object_or_404(User, id=user_id)

            # Create friend request
            friend_request = FriendRequest.objects.create(
                from_user=request.user,
                to_user=to_user
            )

            # Create notification
            notification = Notification.objects.create(
                recipient=to_user,
                sender=request.user,
                notification_type='friend_request',
                title=f'{request.user.username} sent you a friend request',
                message=f'{request.user.first_name or request.user.username} wants to be your friend',
                data={'friend_request_id': str(friend_request.id)}
            )

            # Send real-time notification
            async_to_sync(channel_layer.group_send)(
                f'notifications_{to_user.id}',
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
                            'id': request.user.id,
                            'username': request.user.username,
                            'first_name': request.user.first_name,
                            'last_name': request.user.last_name,
                        }
                    }
                }
            )

            return Response(
                FriendRequestSerializer(friend_request).data,
                status=status.HTTP_201_CREATED
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AcceptFriendRequestView(APIView):
    """Accept a friend request"""
    permission_classes = [IsAuthenticated]

    def post(self, request, request_id):
        friend_request = get_object_or_404(
            FriendRequest,
            id=request_id,
            to_user=request.user,
            status='pending'
        )

        # Update request status
        friend_request.status = 'accepted'
        friend_request.save()

        # Create mutual contact relationships
        Contact.objects.create(
            owner=request.user, contact_user=friend_request.from_user)
        Contact.objects.create(
            owner=friend_request.from_user, contact_user=request.user)

        # Create notification for sender
        notification = Notification.objects.create(
            recipient=friend_request.from_user,
            sender=request.user,
            notification_type='friend_accepted',
            title=f'{request.user.username} accepted your friend request',
            message=f'You and {request.user.first_name or request.user.username} are now friends!',
            data={'user_id': request.user.id}
        )

        # Send real-time notification
        async_to_sync(channel_layer.group_send)(
            f'notifications_{friend_request.from_user.id}',
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
                        'id': request.user.id,
                        'username': request.user.username,
                        'first_name': request.user.first_name,
                        'last_name': request.user.last_name,
                    }
                }
            }
        )

        return Response(
            {'message': 'Friend request accepted'},
            status=status.HTTP_200_OK
        )


class DeclineFriendRequestView(APIView):
    """Decline a friend request"""
    permission_classes = [IsAuthenticated]

    def post(self, request, request_id):
        friend_request = get_object_or_404(
            FriendRequest,
            id=request_id,
            to_user=request.user,
            status='pending'
        )

        friend_request.status = 'declined'
        friend_request.save()

        return Response(
            {'message': 'Friend request declined'},
            status=status.HTTP_200_OK
        )


class BlockUserView(APIView):
    """Block a user"""
    permission_classes = [IsAuthenticated]

    def post(self, request, user_id):
        user_to_block = get_object_or_404(User, id=user_id)

        if user_to_block == request.user:
            return Response(
                {'error': 'Cannot block yourself'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create or get blocked relationship
        blocked, created = BlockedUser.objects.get_or_create(
            blocker=request.user,
            blocked=user_to_block
        )

        if created:
            # Remove from contacts if they were friends
            Contact.objects.filter(
                Q(owner=request.user, contact_user=user_to_block) |
                Q(owner=user_to_block, contact_user=request.user)
            ).delete()

            # Decline any pending friend requests
            FriendRequest.objects.filter(
                Q(from_user=request.user, to_user=user_to_block) |
                Q(from_user=user_to_block, to_user=request.user),
                status='pending'
            ).update(status='declined')

        return Response(
            {'message': 'User blocked successfully'},
            status=status.HTTP_200_OK
        )


class UnblockUserView(APIView):
    """Unblock a user"""
    permission_classes = [IsAuthenticated]

    def post(self, request, user_id):
        user_to_unblock = get_object_or_404(User, id=user_id)

        BlockedUser.objects.filter(
            blocker=request.user,
            blocked=user_to_unblock
        ).delete()

        return Response(
            {'message': 'User unblocked successfully'},
            status=status.HTTP_200_OK
        )
