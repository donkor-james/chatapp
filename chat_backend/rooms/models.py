import uuid
import secrets
from django.db import models
from django.conf import settings
from django.utils import timezone


class Room(models.Model):
    class Status(models.TextChoices):
        WAITING = 'waiting', 'Waiting'
        ACTIVE = 'active', 'Active'
        ENDED = 'ended', 'Ended'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    topic = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    host = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='hosted_rooms',
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.WAITING
    )
    invite_token = models.CharField(max_length=64, unique=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.invite_token:
            self.invite_token = secrets.token_urlsafe(32)
        super().save(*args, **kwargs)

    def end(self):
        self.status = self.Status.ENDED
        self.ended_at = timezone.now()
        self.save(update_fields=['status', 'ended_at'])

    def __str__(self):
        return f'"{self.topic}" hosted by {self.host.username}'


class RoomMembership(models.Model):
    class Role(models.TextChoices):
        HOST = 'host', 'Host'
        MEMBER = 'member', 'Member'

    room = models.ForeignKey(
        Room, on_delete=models.CASCADE, related_name='memberships'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='room_memberships',
    )
    role = models.CharField(
        max_length=20, choices=Role.choices, default=Role.MEMBER
    )
    joined_at = models.DateTimeField(auto_now_add=True)
    left_at = models.DateTimeField(null=True, blank=True)
    # Whether the user is currently connected via WebSocket
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ('room', 'user')
        ordering = ['joined_at']

    def leave(self):
        self.is_active = False
        self.left_at = timezone.now()
        self.save(update_fields=['is_active', 'left_at'])

    def __str__(self):
        return f'{self.user.username} in {self.room.topic} ({self.role})'


class RoomMessage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    room = models.ForeignKey(
        Room, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='room_messages'
    )
    content = models.TextField()
    is_edited = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'{self.sender.username}: {self.content[:60]}'


# class DirectMessage(models.Model):
#     """
#     Private message between two members of the same room session.
#     Scoped to a room so the conversation is contextual.
#     """
#     id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
#     room = models.ForeignKey(
#         Room, on_delete=models.CASCADE, related_name='direct_messages'
#     )
#     sender = models.ForeignKey(
#         settings.AUTH_USER_MODEL,
#         on_delete=models.CASCADE,
#         related_name='sent_dms',
#     )
#     recipient = models.ForeignKey(
#         settings.AUTH_USER_MODEL,
#         on_delete=models.CASCADE,
#         related_name='received_dms',
#     )
#     content = models.TextField()
#     created_at = models.DateTimeField(auto_now_add=True)
#     read_at = models.DateTimeField(null=True, blank=True)

#     class Meta:
#         ordering = ['created_at']

#     def __str__(self):
#         return f'DM from {self.sender.username} to {self.recipient.username}'


class RoomInvite(models.Model):
    """
    Explicit invite sent to a specific user (vs the open invite_token on Room).
    """
    room = models.ForeignKey(
        Room, on_delete=models.CASCADE, related_name='invites'
    )
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_room_invites',
    )
    invited_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='received_room_invites',
    )
    accepted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('room', 'invited_user')
