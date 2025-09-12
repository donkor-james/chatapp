from django.core.mail import send_mail
from django.conf import settings

frontend = settings.FRONTEND_URL
sender = settings.EMAIL_HOST_USER


def send_verification_email(user):
    subject = "Verify your email address"
    message = f"""
    Hi {user.first_name}, 

    click on the link to verify email address:
    {frontend}/verify-email?token={user.email_verification_token}

    This link will expire in 24 hours
    Best regards
    """

    send_mail(subject=subject,
              message=message,
              from_email=sender,
              recipient_list=[user.email],
              fail_silently=False
              )


def send_2FA_code_email(user):
    subject = "Your Login Verification Code"
    message = f"""
    Hi {user.first_name},

    Your Verification Code is: {user.two_factor_code}

    This code will expire in 5 minutes.
    If you didn't request this code, please ignore this

    Best regards
    """

    send_mail(
        subject=subject,
        message=message,
        from_email=sender,
        recipient_list=[user.email],
        fail_silently=False
    )


def send_reset_password_email(user):
    subject = "Reset Password Request"
    message = f"""
    Hi {user.first_name},

    You requested to reset password. Please click on the link below to reset password:
    {frontend}/reset-password?token={user.reset_password_token}

    Link will expire in an hour.

    If you didn't request this reset, please ignore this email.

    Best regards
    """

    send_mail(
        subject=subject,
        message=message,
        from_email=sender,
        recipient_list=[user.email],
        fail_silently=False
    )
