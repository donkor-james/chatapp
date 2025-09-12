from rest_framework import serializers
from .models import Contact, FriendRequest, BlockedUser
from accounts.models import User


class ContactSerializer(serializers.ModelSerializer):
    contact_user = serializers.SerializerMethodField()

    class Meta:
        model = Contact
        fields = ('id', 'contact_user', 'created_at')

    def get_contact_user(self, obj):
        return {
            'id': obj.contact_user.id,
            'username': obj.contact_user.username,
            'email': obj.contact_user.email,
            'first_name': obj.contact_user.first_name,
            'last_name': obj.contact_user.last_name,
        }


class FriendRequestSerializer(serializers.ModelSerializer):
    from_user = serializers.SerializerMethodField()
    to_user = serializers.SerializerMethodField()

    class Meta:
        model = FriendRequest
        fields = ('id', 'from_user', 'to_user',
                  'status', 'created_at', 'updated_at')
        read_only_fields = ('from_user',)

    def get_from_user(self, obj):
        return {
            'id': obj.from_user.id,
            'username': obj.from_user.username,
            'first_name': obj.from_user.first_name,
            'last_name': obj.from_user.last_name,
        }

    def get_to_user(self, obj):
        return {
            'id': obj.to_user.id,
            'username': obj.to_user.username,
            'first_name': obj.to_user.first_name,
            'last_name': obj.to_user.last_name,
        }


class SendFriendRequestSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()

    def validate_user_id(self, value):
        try:
            user = User.objects.get(id=value)
        except User.DoesNotExist:
            raise serializers.ValidationError("User does not exist")

        request_user = self.context['request'].user

        # Check if trying to add themselves
        if user == request_user:
            raise serializers.ValidationError(
                "Cannot send friend request to yourself")

        # Check if already friends
        if Contact.objects.filter(owner=request_user, contact_user=user).exists():
            raise serializers.ValidationError("Already in contacts")

        # Check if request already exists
        if FriendRequest.objects.filter(from_user=request_user, to_user=user, status='pending').exists():
            raise serializers.ValidationError("Friend request already sent")

        # Check if user is blocked
        if BlockedUser.objects.filter(blocker=user, blocked=request_user).exists():
            raise serializers.ValidationError(
                "Cannot send friend request to this user")

        return value
