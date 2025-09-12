from rest_framework import serializers
from .models import Message, MessageRead


class MessageSerializer(serializers.ModelSerializer):
    sender = serializers.SerializerMethodField()
    reply_to = serializers.SerializerMethodField()
    is_read = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ('id', 'chat', 'sender', 'content', 'message_type', 'file',
                  'created_at', 'updated_at', 'is_edited', 'reply_to', 'is_read')
        read_only_fields = ('id', 'sender', 'created_at',
                            'updated_at', 'is_edited')

    def get_sender(self, obj):
        return {
            'id': obj.sender.id,
            'username': obj.sender.username,
            'first_name': obj.sender.first_name,
            'last_name': obj.sender.last_name,
        }

    def get_reply_to(self, obj):
        if obj.reply_to:
            return {
                'id': str(obj.reply_to.id),
                'content': obj.reply_to.content[:100],
                'sender': obj.reply_to.sender.username,
            }
        return None

    def get_is_read(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return MessageRead.objects.filter(message=obj, user=request.user).exists()
        return False


class CreateMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ('content', 'message_type', 'file', 'reply_to')

    def validate_reply_to(self, value):
        if value and value.chat != self.context['chat']:
            raise serializers.ValidationError(
                "Cannot reply to message from different chat")
        return value
