from django.db import models
from django.conf import settings
from django.utils import timezone


class Chat(models.Model):
    CHAT_TYPES = (
        ('private', 'Private Chat'),
        ('group', 'Group Chat'),
    )

    name = models.CharField(max_length=100, blank=True, null=True)
    chat_type = models.CharField(
        max_length=20, choices=CHAT_TYPES, default='private')
    # Use string reference for User model to avoid early evaluation
    members = models.ManyToManyField(
        settings.AUTH_USER_MODEL, related_name='chats', through='ChatMembership')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='created_chats')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        if self.chat_type == 'private':
            members = list(self.members.all()[:2])
            return f"Private chat: {members[0].username} & {members[1].username if len(members) > 1 else 'Unknown'}"
        return self.name or f"Group Chat {self.id}"

    @property
    def last_message(self):
        return self.messages.first()  # Assuming messages are ordered by -created_at

    def get_other_member(self, user):
        """For private chats, get the other member"""
        if self.chat_type == 'private':
            return self.members.exclude(id=user.id).first()
        return None


class ChatMembership(models.Model):
    ROLES = (
        ('member', 'Member'),
        ('admin', 'Admin'),
        ('owner', 'Owner'),
    )

    chat = models.ForeignKey(Chat, on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL,
                             on_delete=models.CASCADE)
    role = models.CharField(max_length=20, choices=ROLES, default='member')
    joined_at = models.DateTimeField(auto_now_add=True)
    last_read_message = models.ForeignKey(
        'chat_messages.Message', on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        unique_together = ('chat', 'user')
