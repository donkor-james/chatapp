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
from chats.models import Chat, ChatMembership
from chats.serializers import ChatSerializer
from accounts.serializers import UserProfileSerializer
import random

channel_layer = get_channel_layer()


class ContactSuggestionView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        print(f"ContactSuggestionView called for user: {user}")
        # Get IDs of users already connected (contacts) and self
        contact_ids = set([user.id])
        contact_ids.update(Contact.objects.filter(
            owner=user).values_list('contact_user_id', flat=True))

        # Get IDs of users the current user has already sent a friend request to (pending or accepted)
        sent_request_ids = set(
            FriendRequest.objects.filter(from_user=user)
            .exclude(status='declined')
            .values_list('to_user_id', flat=True)
        )

        # Get IDs of users who have sent friend requests TO the current user (pending or accepted)
        received_request_ids = set(
            FriendRequest.objects.filter(to_user=user)
            .exclude(status='declined')
            .values_list('from_user_id', flat=True)
        )

        print(f"Contact IDs: {contact_ids}")
        print(f"Sent request IDs: {sent_request_ids}")
        print(f"Received request IDs: {received_request_ids}")
        print(
            f"Total exclude IDs: {contact_ids.union(sent_request_ids).union(received_request_ids)}")

        # Exclude current user, their contacts, users they've sent requests to, and users who've sent requests to them
        exclude_ids = contact_ids.union(
            sent_request_ids).union(received_request_ids)
        qs = User.objects.exclude(id__in=exclude_ids)
        user_count = qs.count()
        num_suggestions = min(10, user_count)
        suggestions = random.sample(
            list(qs), num_suggestions) if user_count > 0 else []
        data = UserProfileSerializer(suggestions, many=True).data
        return Response(data)


class ContactListView(generics.ListAPIView):
    """Get user's contacts/friends"""
    serializer_class = ContactSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        print("contacts: ", Contact.objects.filter(
            owner=self.request.user).select_related('contact_user'))
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
            # print("sent request list: ", queryset.filter(
            #     from_user=user), "type: ", request_type)
            # return queryset.filter(from_user=user)
            return None
        elif request_type == 'received':
            print("sent request list: ", queryset.filter(
                to_user=user), "type: ", request_type)
            return queryset.filter(to_user=user, status='pending')
        else:
            print("type: ", request_type)
            return queryset.filter(Q(from_user=user) | Q(to_user=user))


class SendFriendRequestView(APIView):
    """Send a friend request"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        print(f"SendFriendRequestView received data: {request.data}")
        serializer = SendFriendRequestSerializer(
            data=request.data, context={'request': request})
        if serializer.is_valid():
            user_id = serializer.validated_data['user_id']
            print(f"Validated user_id: {user_id}")
            to_user = get_object_or_404(User, id=user_id)
            print(f"Found to_user: {to_user}")

            # Get or create friend request (handle declined requests)
            friend_request, created = FriendRequest.objects.get_or_create(
                from_user=request.user,
                to_user=to_user,
                defaults={'status': 'pending'}
            )

            # If it existed but was declined, reset it to pending
            if not created and friend_request.status == 'declined':
                friend_request.status = 'pending'
                friend_request.save()
                print(
                    f"Reset declined friend_request to pending: {friend_request.id}")
            elif created:
                print(f"Created new friend_request: {friend_request.id}")
            else:
                print(
                    f"Friend request already exists with status: {friend_request.status}")

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
                            'id': str(request.user.id),
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

        print(f"Serializer errors: {serializer.errors}")
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
            data={'user_id': str(request.user.id)}
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
                        'id': str(request.user.id),
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


class StartChatWithContactView(APIView):
    """Start a private chat with a contact (or get existing)"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        contact_user_id = request.data.get('contact_user_id')
        if not contact_user_id:
            return Response({'error': 'contact_user_id required'}, status=status.HTTP_400_BAD_REQUEST)

        # Check contact exists
        contact = Contact.objects.filter(
            owner=request.user, contact_user_id=contact_user_id).first()
        if not contact:
            return Response({'error': 'Contact not found'}, status=status.HTTP_404_NOT_FOUND)

        # Check if chat already exists
        existing_chat = Chat.objects.filter(
            chat_type='private',
            members=request.user
        ).filter(members__id=contact_user_id).first()
        if existing_chat:
            return Response(ChatSerializer(existing_chat, context={'request': request}).data, status=status.HTTP_200_OK)

        # Create new chat
        chat = Chat.objects.create(
            chat_type='private',
            created_by=request.user
        )
        ChatMembership.objects.create(
            chat=chat, user=request.user, role='member')
        ChatMembership.objects.create(
            chat=chat, user_id=contact_user_id, role='member')

        return Response(ChatSerializer(chat, context={'request': request}).data, status=status.HTTP_201_CREATED)
