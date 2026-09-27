from rest_framework import serializers
from .models import Follow, Block
from accounts.models import User


class UserSummarySerializer(serializers.ModelSerializer):
    """Lightweight user representation reused across follow responses."""
    id = serializers.CharField()  # already a string from UUIDField

    class Meta:
        model = User
        fields = ('id', 'username', 'first_name', 'last_name')


class FollowSerializer(serializers.ModelSerializer):
    follower = UserSummarySerializer(read_only=True)
    followee = UserSummarySerializer(read_only=True)

    class Meta:
        model = Follow
        fields = ('id', 'follower', 'followee', 'created_at')


class FollowActionSerializer(serializers.Serializer):
    user_id = serializers.UUIDField()

    def validate_user_id(self, value):
        request_user = self.context['request'].user

        if str(request_user.id) == str(value):
            raise serializers.ValidationError('You cannot follow yourself.')

        if not User.objects.filter(id=value).exists():
            raise serializers.ValidationError('User does not exist.')

        if Block.objects.filter(blocker_id=value, blocked=request_user).exists():
            raise serializers.ValidationError('Action not permitted.')

        return value
