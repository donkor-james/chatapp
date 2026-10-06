import resend
from django.conf import settings

resend.api_key = settings.RESEND_API_KEY
frontend = settings.FRONTEND_URL


def send_verification_email(user):
    resend.Emails.send({
        "from": settings.DEFAULT_FROM_EMAIL,
        "to": [user.email],
        "subject": "Verify your email address",
        "html": f"""
        <p>Hi {user.first_name},</p>
        <p>Click the link below to verify your email address:</p>
        <p><a href="{frontend}/verify-email?token={user.email_verification_token}">
            Verify Email
        </a></p>
        <p>This link expires in 24 hours.</p>
        <p>Best regards</p>
        """,
    })


def send_2FA_code_email(user):
    resend.Emails.send({
        "from": settings.DEFAULT_FROM_EMAIL,
        "to": [user.email],
        "subject": "Your Login Verification Code",
        "html": f"""
        <p>Hi {user.first_name},</p>
        <p>Your verification code is: <strong>{user.two_factor_code}</strong></p>
        <p>This code expires in 5 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
        """,
    })


def send_reset_password_email(user):
    resend.Emails.send({
        "from": settings.DEFAULT_FROM_EMAIL,
        "to": [user.email],
        "subject": "Reset Your Password",
        "html": f"""
        <p>Hi {user.first_name},</p>
        <p>Click the link below to reset your password:</p>
        <p><a href="{frontend}/reset-password?token={user.password_reset_token}">
            Reset Password
        </a></p>
        <p>This link expires in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
        """,
    })
