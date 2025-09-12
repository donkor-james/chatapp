from rest_framework import serializers
from .models import Chat, ChatMembership
from accounts.models import User
from chat_messages.serializers import MessageSerializer


class ChatMemberSerializer(serializers.ModelSerializer):
    user = serializers.SerializerMethodField()

    class Meta:
        model = ChatMembership
        fields = ('user', 'role', 'joined_at')

    def get_user(self, obj):
        return {
            'id': obj.user.id,
            'username': obj.user.username,
            'email': obj.user.email,
            'first_name': obj.user.first_name,
            'last_name': obj.user.last_name,
        }


class ChatSerializer(serializers.ModelSerializer):
    members = ChatMemberSerializer(
        source='chatmembership_set', many=True, read_only=True)
    last_message = MessageSerializer(read_only=True)
    unread_count = serializers.SerializerMethodField()
    other_member = serializers.SerializerMethodField()

    class Meta:
        model = Chat
        fields = ('id', 'name', 'chat_type', 'members', 'created_by', 'created_at',
                  'updated_at', 'last_message', 'unread_count', 'other_member')
        read_only_fields = ('created_by', 'created_at', 'updated_at')

    def get_unread_count(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return 0

        membership = obj.chatmembership_set.filter(user=request.user).first()
        if not membership:
            return 0

        if membership.last_read_message:
            return obj.messages.filter(created_at__gt=membership.last_read_message.created_at).count()
        return obj.messages.count()

    def get_other_member(self, obj):
        """For private chats, return the other member's info"""
        request = self.context.get('request')
        if obj.chat_type == 'private' and request and request.user.is_authenticated:
            other_member = obj.get_other_member(request.user)
            if other_member:
                return {
                    'id': other_member.id,
                    'username': other_member.username,
                    'first_name': other_member.first_name,
                    'last_name': other_member.last_name,
                }
        return None


class CreateChatSerializer(serializers.Serializer):
    name = serializers.CharField(
        max_length=100, required=False, allow_blank=True)
    chat_type = serializers.ChoiceField(
        choices=Chat.CHAT_TYPES, default='private')
    member_ids = serializers.ListField(
        child=serializers.IntegerField(), min_length=1)

    def validate_member_ids(self, value):
        # Check if all users exist
        existing_users = User.objects.filter(id__in=value).count()
        if existing_users != len(value):
            raise serializers.ValidationError("Some users do not exist")
        return value

    def validate(self, attrs):
        if attrs['chat_type'] == 'private' and len(attrs['member_ids']) != 1:
            raise serializers.ValidationError(
                "Private chats must have exactly one other member")
        return attrs
