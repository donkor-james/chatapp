from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class Contact(models.Model):
    owner = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='contacts')
    contact_user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='contacted_by')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('owner', 'contact_user')

    def __str__(self):
        return f"{self.owner.username} -> {self.contact_user.username}"


class FriendRequest(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('declined', 'Declined'),
    )

    from_user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='sent_requests')
    to_user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='received_requests')
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('from_user', 'to_user')

    def __str__(self):
        return f"{self.from_user.username} -> {self.to_user.username} ({self.status})"


class BlockedUser(models.Model):
    blocker = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='blocked_users')
    blocked = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='blocked_by')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('blocker', 'blocked')
