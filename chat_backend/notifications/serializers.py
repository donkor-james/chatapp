from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    sender = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = ('id', 'sender', 'notification_type', 'title', 'message',
                  'data', 'is_read', 'created_at')
        read_only_fields = ('sender',)

    def get_sender(self, obj):
        if obj.sender:
            return {
                'id': obj.sender.id,
                'username': obj.sender.username,
                'first_name': obj.sender.first_name,
                'last_name': obj.sender.last_name,
            }
        return None
