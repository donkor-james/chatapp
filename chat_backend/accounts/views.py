# JWT Refresh Token View
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from .models import User
from .utils import send_verification_email, send_reset_password_email, send_2FA_code_email
import secrets
from datetime import timedelta
from rest_framework.views import APIView
from rest_framework import generics
from django.utils import timezone
from django.shortcuts import render
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken
from .serializers import (UserRegisterSerializer, UserLoginSerializer, EmailVerificatioSerializer,
                          ResendEmailSerializer, PasswordResetSerializer, PasswordChangeSerializer,
                          PasswordResetConfirmSerializer, Verify2FASerializer, Enable2FASerializer, UserProfileSerializer
                          )


def generate_tokens(user):
    refresh = RefreshToken.for_user(user)
    return {
        "refresh": str(refresh),
        "access": str(refresh.access_token)
    }


class RegisterView(APIView):
    serializer_class = UserRegisterSerializer
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = self.serializer_class(data=request.data)

        if serializer.is_valid():
            user = serializer.save()
            print(user.__dict__)

            # send verification email
            send_verification_email(user)

            return Response({
                "message": "Registration successful!. Plesase check email to verify your account."
            })

        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    serializer_class = UserLoginSerializer
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data['user']

            if user.two_factor_enabled:
                # send 2FA code
                user.generate_2fa_code()
                send_2FA_code_email(user)

                # generating temp token
                temp_token = RefreshToken.for_user(user)
                return Response({
                    "message": "Login successful! Please check your email for the 2FA code.",
                    "requires_2fa": True,
                    "temp_token": str(temp_token)
                }, status=status.HTTP_200_OK)
            else:
                # normal login, return tokens
                tokens = generate_tokens(user)
                return Response({
                    "message": "Login successful.",
                    "access_token": tokens["access"],
                    "refresh_token": tokens["refresh"],
                    "user": {
                        "user_id": user.id,
                        "email": user.email,
                        "username": user.username,
                        "first_name": user.first_name,
                        "last_name": user.last_name,
                        "created_at": user.created_at,
                        "is_email_verified": user.is_email_verified,
                        "two_factor_enabled": user.two_factor_enabled
                    }
                }, status=status.HTTP_200_OK)

        errors = serializer.errors
        if 'non_field_errors' in errors:
            error_msg = str(errors['non_field_errors'][0])
            return Response({'error': error_msg}, status=status.HTTP_400_BAD_REQUEST)
        else:
            # Return first field error
            field_name = list(errors.keys())[0]
            error_msg = str(errors[field_name][0])
            return Response({'error': error_msg}, status=status.HTTP_400_BAD_REQUEST)


class EmailVerificationView(APIView):
    serializer_class = EmailVerificatioSerializer
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        if serializer.is_valid():
            token = serializer.validated_data.get("token")

            try:
                user = User.objects.get(email_verification_token=token)
                if user.email_verification_sent_at:
                    time_diff = timezone.now() - user.email_verification_sent_at

                    if time_diff > timedelta(hours=24):
                        return Response({"error": "Verification link expired."}, status=status.HTTP_400_BAD_REQUEST)

                    user.is_email_verified = True
                    user.email_verification_token = None
                    user.email_verification_sent_at = None
                    user.save()

                    tokens = generate_tokens(user)
                    return Response({
                        "message": "Email verification successful.",
                        "user": {
                            "user_id": user.id,
                            "email": user.email,
                            "username": user.username,
                            "first_name": user.first_name,
                            "last_name": user.last_name,
                            "created_at": user.created_at,
                            "is_email_verified": user.is_email_verified,
                            "two_factor_enabled": user.two_factor_enabled
                        },
                        "tokens": tokens
                    }, status=status.HTTP_200_OK)
            except User.DoesNotExist:
                return Response("User does not exist", status=status.HTTP_404_NOT_FOUND)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PasswordChangeView(APIView):
    """Change password for authenticated users"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PasswordChangeSerializer(
            data=request.data, context={'request': request})
        if serializer.is_valid():
            user = request.user
            user.set_password(serializer.validated_data['new_password'])
            user.save()

            return Response({'message': 'Password changed successfully'}, status=status.HTTP_200_OK)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PasswordResetView(APIView):
    serializer_class = PasswordResetSerializer
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = self.serializer_class(
            data=request.data, context={'request': request})

        if serializer.is_valid():
            user = self.context.get("user")

            if user:
                user.password_reset_token = secrets.token_urlsafe(32)
                user.password_reset_sent_at = timezone.now()

                # send reset link
                send_reset_password_email(user)

            return Response({
                "message": "If an account with this email exists, you will recieve a password reset link"
            }, status=status.HTTP_200_OK)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PasswordResetConfirmView(APIView):
    serializer_class = PasswordResetConfirmSerializer
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = self.serializer_class(data=request.data)

        if serializer.is_valid():
            token = serializer.validated_data.get('token')
            user = User.objects.get(password_reset_token=token)

            try:
                time_diff = timezone.now() - user.password_reset_token
                if time_diff > 600:
                    return Response({'error': 'Reset token has expired'}, status=status.HTTP_400_BAD_REQUEST)

                user.set_password(
                    serializer.validated_data.get('new_password'))
                user.password_reset_token = None
                user.password_reset_sent_at = None
                user.save()

                return Response({
                    'message': 'Password has been reset successfully',
                }, status=status.HTTP_200_OK)

            except User.DoesNotExist:
                return Response({'error': 'Invalid reset token'}, status=status.HTTP_404_NOT_FOUND)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ResendEmailVerificationView(APIView):
    """Resend email verification"""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResendEmailSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']

            try:
                user = User.objects.get(email=email)
                if user.is_email_verified:
                    return Response(
                        {'message': 'Email is already verified'},
                        status=status.HTTP_200_OK
                    )

                # Generate new token and send email
                user.generate_email_verification_token()
                user.save()
                send_verification_email(user)

                return Response({
                    'message': 'Verification email sent successfully'
                }, status=status.HTTP_200_OK)

            except User.DoesNotExist:
                # Don't reveal if email doesn't exist
                return Response({
                    'message': 'If an account with that email exists, a verification email has been sent'
                }, status=status.HTTP_200_OK)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class Verify2FAView(APIView):
    serializer_class = Verify2FASerializer
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        if serializer.is_valid():
            code = serializer.validated_data.get("code")
            temp_token = serializer.validated_data.get("temp_token")

            if not temp_token:
                return Response({
                    "error": "Invalid temporary token."
                }, status=status.HTTP_400_BAD_REQUEST)

            try:
                refresh = RefreshToken(temp_token)
                user = User.objects.get(id=refresh['user_id'])

                if user.is_2fa_code_valid(code):
                    user.clear_2fa_code()

                    tokens = generate_tokens(user)

                    return Response({
                        "message": "2FA verification successful!",
                        "access_token": tokens["access"],  # Make it consistent
                        "refresh_token": tokens["refresh"],
                        "user": {
                            "user_id": user.id,
                            "email": user.email,
                            "username": user.username,
                            "first_name": user.first_name,
                            "last_name": user.last_name,
                            "created_at": user.created_at,
                            "is_email_verified": user.is_email_verified,
                            "two_factor_enabled": user.two_factor_enabled
                        }
                    }, status=status.HTTP_200_OK)
                else:
                    return Response({
                        "error": "Invalid 2FA code."
                    }, status=status.HTTP_400_BAD_REQUEST)
            except Exception as e:
                return Response({
                    "error": "Invalid or expired temporary token."
                }, status=status.HTTP_400_BAD_REQUEST)

        return Response({"error": "Invalid data provided."}, status=status.HTTP_400_BAD_REQUEST)


class Enable2FAView(APIView):
    """Enable 2FA for user account"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = Enable2FASerializer(
            data=request.data, context={'request': request})
        if serializer.is_valid():
            user = request.user

            if user.two_factor_enabled:
                return Response(
                    {'message': '2FA is already enabled'},
                    status=status.HTTP_200_OK
                )

            # Enable 2FA and send test code
            user.two_factor_enabled = True
            user.save()

            # Generate and send test code
            code = user.generate_2FA_code()
            send_2FA_code_email(user)

            return Response({
                'message': '2FA enabled successfully. A test code has been sent to your email.'
            }, status=status.HTTP_200_OK)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class Disable2FAView(APIView):
    """Disable 2FA for user account"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        user.two_factor_enabled = False
        user.two_factor_code = None
        user.two_factor_code_created_at = None
        user.save()

        return Response({'message': '2FA disabled successfully'}, status=status.HTTP_200_OK)


class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({'message': 'Logout successful.'}, status=status.HTTP_200_OK)
        except (TokenError, InvalidToken, Exception):
            return Response({'error': 'Invalid or expired token.'}, status=status.HTTP_400_BAD_REQUEST)


class RefreshTokenView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response({'error': 'Refresh token required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            refresh = RefreshToken(refresh_token)
            access_token = str(refresh.access_token)
            return Response({'access': access_token}, status=status.HTTP_200_OK)
        except Exception:
            return Response({'error': 'Invalid or expired refresh token.'}, status=status.HTTP_400_BAD_REQUEST)


class UserRetrieveUpdateView(generics.RetrieveUpdateAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user
