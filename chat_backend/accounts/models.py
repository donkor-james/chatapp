import random
import secrets
import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone
# Create your models here.


class User(AbstractUser):
    id = models.UUIDField(default=uuid.uuid4, primary_key=True, editable=False)
    email = models.EmailField(unique=True)
    is_email_verified = models.BooleanField(default=False)
    email_verification_token = models.CharField(
        max_length=100, null=True, blank=True)
    email_verification_sent_at = models.DateTimeField(blank=True, null=True)
    two_factor_enabled = models.BooleanField(default=False)
    two_factor_code = models.CharField(null=True, blank=True, max_length=6)
    two_factor_code_created_at = models.DateTimeField(blank=True, null=True)
    password_reset_token = models.CharField(
        max_length=100, null=True, blank=True)
    password_reset_sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    def generate_email_verification_token(self):
        """ Generate email verification code """
        self.email_verification_token = secrets.token_urlsafe(32)
        self.email_verification_sent_at = timezone.now()
        self.save()
        return self.email_verification_token

    def generate_2fa_code(self):
        """Generate code for 2 factor authentication"""
        self.two_factor_code = f"{random.randint(100000, 999999)}"
        self.two_factor_code_created_at = timezone.now()
        self.save()
        return self.two_factor_code

    def is_2fa_code_valid(self, code):
        "Verify code"
        if not self.two_factor_code or self.two_factor_code != code:
            return False

        if self.two_factor_code_created_at:
            time_diff = timezone.now() - self.two_factor_code_created_at
            if time_diff > 300:
                return False

        return True

    def clear_2fa_code(self):
        """ Clear 2fa code on success"""
        self.two_factor_code = None
        self.two_factor_code_created_at = None
        self.save()

    def __str__(self):
        return self.email
