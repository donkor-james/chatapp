from rest_framework import serializers
from django.conf import settings
from .models import Room, RoomMembership, RoomMessage, DirectMessage, RoomInvite


class MemberSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='user.id')
    username = serializers.CharField(source='user.username')
    first_name = serializers.CharField(source='user.first_name')
    last_name = serializers.CharField(source='user.last_name')

    class Meta:
        model = RoomMembership
        fields = ('id', 'username', 'first_name',
                  'last_name', 'role', 'joined_at')


class RoomSerializer(serializers.ModelSerializer):
    host = serializers.SerializerMethodField()
    members = serializers.SerializerMethodField()
    member_count = serializers.SerializerMethodField()
    invite_url = serializers.SerializerMethodField()

    class Meta:
        model = Room
        fields = (
            'id', 'topic', 'description', 'host', 'status',
            'members', 'member_count', 'invite_url', 'invite_token', 'created_at', 'ended_at',
        )
        read_only_fields = ('id', 'status', 'created_at', 'ended_at')

    def get_host(self, obj):
        return {
            'id': str(obj.host.id),
            'username': obj.host.username,
            'first_name': obj.host.first_name,
            'last_name': obj.host.last_name,
        }

    def get_members(self, obj):
        active = obj.memberships.filter(is_active=True).select_related('user')
        return MemberSerializer(active, many=True).data

    def get_member_count(self, obj):
        return obj.memberships.filter(is_active=True).count()

    def get_invite_url(self, obj):
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(f'/api/rooms/join/{obj.invite_token}/')
        return f'/api/rooms/join/{obj.invite_token}/'


class CreateRoomSerializer(serializers.Serializer):
    topic = serializers.CharField(max_length=200)
    description = serializers.CharField(
        required=False, allow_blank=True, default='')
    # UUIDs of followers to invite immediately
    invite_user_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        default=list,
    )


class RoomMessageSerializer(serializers.ModelSerializer):
    sender = serializers.SerializerMethodField()

    class Meta:
        model = RoomMessage
        fields = ('id', 'room', 'sender', 'content', 'created_at')
        read_only_fields = ('id', 'created_at', 'sender', 'room')

    def get_sender(self, obj):
        return {
            'id': str(obj.sender.id),
            'username': obj.sender.username,
            'first_name': obj.sender.first_name,
            'last_name': obj.sender.last_name,
        }


class DirectMessageSerializer(serializers.ModelSerializer):
    sender = serializers.SerializerMethodField()
    recipient_id = serializers.CharField(source='recipient.id')

    class Meta:
        model = DirectMessage
        fields = ('id', 'room', 'sender', 'recipient_id',
                  'content', 'created_at', 'read_at')
        read_only_fields = ('id', 'created_at', 'read_at')

    def get_sender(self, obj):
        return {
            'id': str(obj.sender.id),
            'username': obj.sender.username,
        }


class SendDirectMessageSerializer(serializers.Serializer):
    recipient_id = serializers.UUIDField()
    content = serializers.CharField(min_length=1, max_length=4000)

    def validate_content(self, value):
        return value.strip()
