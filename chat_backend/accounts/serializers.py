from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.contrib.auth import authenticate
from .models import User


class UserRegisterSerializer(serializers.ModelSerializer):
    created_at = serializers.CharField(read_only=True)
    password = serializers.CharField(
        write_only=True, validators=[validate_password])
    confirm_password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['email', 'username', 'first_name', 'last_name',
                  'password', 'confirm_password', 'created_at']

    def validate(self, attrs):
        if attrs['password'] != attrs['confirm_password']:
            raise ValidationError("password do not match")

        if User.objects.filter(email=attrs['email']).exists():
            raise ValidationError('User with this email already exists')
        return attrs

    def create(self, validated_data):
        validated_data.pop('confirm_password')

        user = User.objects.create_user(
            email=validated_data.get('email'),
            username=validated_data.get("username"),
            first_name=validated_data.get('first_name'),
            last_name=validated_data.get('last_name')
        )
        user.set_password(validated_data.get('password'))
        user.generate_email_verification_token()
        user.save()

        return user


class UserLoginSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True)
    email = serializers.EmailField()

    def validate(self, attrs):
        email = attrs.get("email")
        password = attrs.get("password")

        if not email or not password:
            raise ValidationError("email and password are required")

        user = authenticate(username=email, password=password)
        if not user:
            raise ValidationError("Invalid email or password")

        if not user.is_email_verified:
            raise ValidationError(
                "please verify email before logging in")

        attrs['user'] = user
        return attrs


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = '__all__'


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)
    new_password_confirm = serializers.CharField(write_only=True)

    def validate(self, attrs):
        if attrs.get('new_password') != attrs.get("new_password_confirm"):
            raise ValidationError("New passwords do not match")
        return attrs

    def validate_current_password(self, value):
        user = self.context.get("request").user
        if not user.check_password(value):
            raise ValidationError("Current password is incorrect")
        return value


class PasswordResetSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        try:
            user = User.objects.get(email=value)
            self.context['user'] = user
        except User.DoesNotExist as e:
            self.context['user'] = None
        return value


class PasswordResetConfirmSerializer(serializers.Serializer):
    token = serializers.CharField()
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        if attrs['password'] != attrs['confirm_password']:
            raise ValidationError("passwords do not match")
        return attrs


class EmailVerificatioSerializer(serializers.Serializer):
    token = serializers.CharField()


class ResendEmailSerializer(serializers.Serializer):
    email = serializers.EmailField()


class Verify2FASerializer(serializers.Serializer):
    code = serializers.CharField(max_length=6)


class Enable2FASerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True)

    def validate_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('Password is incorrect')
        return value
