from django.shortcuts import get_object_or_404
from django.db.models import Q
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from .models import Follow, Block
from .serializers import UserSummarySerializer, FollowSerializer, FollowActionSerializer
from accounts.serializers import UserProfileSerializer


class FollowView(APIView):
    """POST /api/followers/follow/  — follow a user."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = FollowActionSerializer(
            data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        followee = get_object_or_404(
            User, id=serializer.validated_data['user_id'])

        _, created = Follow.objects.get_or_create(
            follower=request.user,
            followee=followee,
        )
        if not created:
            return Response({'detail': 'Already following.'}, status=status.HTTP_200_OK)

        return Response({'detail': f'Now following {followee.username}.'}, status=status.HTTP_201_CREATED)


class UnfollowView(APIView):
    """DELETE /api/followers/unfollow/<user_id>/"""
    permission_classes = [IsAuthenticated]

    def delete(self, request, user_id):
        deleted, _ = Follow.objects.filter(
            follower=request.user,
            followee_id=user_id,
        ).delete()

        if not deleted:
            return Response({'detail': 'You were not following this user.'}, status=status.HTTP_404_NOT_FOUND)

        return Response(status=status.HTTP_204_NO_CONTENT)


class FollowersListView(generics.ListAPIView):
    """GET /api/followers/users/<user_id>/followers/"""
    serializer_class = UserSummarySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = get_object_or_404(User, id=self.kwargs['user_id'])
        return User.objects.filter(following__followee=user)


class FollowingListView(generics.ListAPIView):
    """GET /api/followers/users/<user_id>/following/"""
    serializer_class = UserSummarySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = get_object_or_404(User, id=self.kwargs['user_id'])
        return User.objects.filter(followers__follower=user)


class FollowStatsView(APIView):
    """
    GET /api/followers/users/<user_id>/stats/
    Returns follower count, following count, and whether the
    requesting user follows this user (and vice versa).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, user_id):
        user = get_object_or_404(User, id=user_id)
        return Response({
            'followers_count': Follow.objects.filter(followee=user).count(),
            'following_count': Follow.objects.filter(follower=user).count(),
            'you_follow_them': Follow.objects.filter(follower=request.user, followee=user).exists(),
            'they_follow_you': Follow.objects.filter(follower=user, followee=request.user).exists(),
        })


class BlockView(APIView):
    """POST /api/followers/block/<user_id>/"""
    permission_classes = [IsAuthenticated]

    def post(self, request, user_id):
        if str(request.user.id) == str(user_id):
            return Response({'error': 'Cannot block yourself.'}, status=status.HTTP_400_BAD_REQUEST)

        user_to_block = get_object_or_404(User, id=user_id)

        Block.objects.get_or_create(
            blocker=request.user, blocked=user_to_block)

        # Silently remove any follow relationship in either direction
        Follow.objects.filter(
            Q(follower=request.user, followee=user_to_block) |
            Q(follower=user_to_block, followee=request.user)
        ).delete()

        return Response({'detail': f'{user_to_block.username} blocked.'}, status=status.HTTP_200_OK)


class UnblockView(APIView):
    """DELETE /api/followers/unblock/<user_id>/"""
    permission_classes = [IsAuthenticated]

    def delete(self, request, user_id):
        Block.objects.filter(blocker=request.user, blocked_id=user_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class UserDiscoveryView(generics.ListAPIView):
    """
    GET /api/followers/discover/
    Returns users the requester doesn't follow yet and hasn't blocked,
    ordered by how many of the requester's followees also follow them
    (i.e. "people your network follows").
    """
    serializer_class = UserSummarySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        already_following = Follow.objects.filter(
            follower=user
        ).values_list('followee_id', flat=True)

        blocked_ids = Block.objects.filter(
            Q(blocker=user) | Q(blocked=user)
        ).values_list('blocked_id', 'blocker_id')

        excluded_ids = set([user.id])
        excluded_ids.update(already_following)
        for b, bl in blocked_ids:
            excluded_ids.add(b)
            excluded_ids.add(bl)

        return User.objects.exclude(id__in=excluded_ids).order_by('?')[:30]
