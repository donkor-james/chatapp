from rest_framework import serializers
from .models import DirectConversation, DirectMessage


class DirectMessageSerializer(serializers.ModelSerializer):
    sender = serializers.SerializerMethodField()

    class Meta:
        model = DirectMessage
        fields = ('id', 'conversation', 'sender',
                  'content', 'created_at', 'read_at', 'is_edited', 'is_deleted')
        read_only_fields = ('id', 'created_at', 'read_at',
                            'sender', 'conversation')

    def get_sender(self, obj):
        return {
            'id': str(obj.sender.id),
            'username': obj.sender.username,
            'first_name': obj.sender.first_name,
            'last_name': obj.sender.last_name,
        }


class DirectConversationSerializer(serializers.ModelSerializer):
    other_participant = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = DirectConversation
        fields = ('id', 'other_participant', 'last_message',
                  'unread_count', 'created_at', 'last_message_at')

    def get_other_participant(self, obj):
        user = self.context['request'].user
        other = obj.other_participant(user)
        return {
            'id': str(other.id),
            'username': other.username,
            'first_name': other.first_name,
            'last_name': other.last_name,
        }

    def get_last_message(self, obj):
        msg = obj.messages.last()
        if msg:
            return DirectMessageSerializer(msg).data
        return None

    def get_unread_count(self, obj):
        user = self.context['request'].user
        return obj.messages.filter(read_at__isnull=True).exclude(sender=user).count()


class SendMessageSerializer(serializers.Serializer):
    content = serializers.CharField(min_length=1, max_length=4000)

    def validate_content(self, value):
        return value.strip()
