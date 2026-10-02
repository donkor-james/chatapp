import uuid
from django.db import models
from django.conf import settings


class DirectConversation(models.Model):
    """
    Permanent 1-to-1 conversation between two users.
    Created on first contact, survives room endings indefinitely.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    participant_a = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='conversations_as_a',
    )
    participant_b = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='conversations_as_b',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    # Denormalised for cheap "last activity" ordering on the inbox list
    last_message_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        # Enforce one conversation per pair regardless of order
        constraints = [
            models.UniqueConstraint(
                fields=['participant_a', 'participant_b'],
                name='unique_conversation_pair',
            )
        ]
        ordering = ['-last_message_at']

    @classmethod
    def get_or_create_for(cls, user_a, user_b):
        """
        Always store the pair with the smaller UUID as participant_a
        so the UniqueConstraint is direction-agnostic.
        """
        if user_a.id > user_b.id:
            user_a, user_b = user_b, user_a
        conversation, created = cls.objects.get_or_create(
            participant_a=user_a,
            participant_b=user_b,
        )
        return conversation, created

    def other_participant(self, user):
        return self.participant_b if self.participant_a_id == user.id else self.participant_a

    def __str__(self):
        return f'DM: {self.participant_a.username} ↔ {self.participant_b.username}'


class DirectMessage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(
        DirectConversation,
        on_delete=models.CASCADE,
        related_name='messages',
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_direct_messages',
    )
    content = models.TextField()
    is_edited = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'{self.sender.username}: {self.content[:60]}'
