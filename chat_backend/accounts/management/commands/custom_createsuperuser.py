from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils.crypto import get_random_string


class Command(BaseCommand):
    help = 'Create a superuser with custom fields (no email verification)'

    def handle(self, *args, **options):
        User = get_user_model()
        email = input('Email: ')
        password = input('Password: ')
        first_name = input('First name (optional): ')
        last_name = input('Last name (optional): ')

        if User.objects.filter(email=email).exists():
            self.stdout.write(self.style.ERROR(
                'A user with that email already exists.'))
            return

        user = User.objects.create_superuser(
            email=email,
            username=email,
            password=password,
            first_name=first_name,
            last_name=last_name
        )
        # If you have a field like is_email_verified, set it True for superuser
        if hasattr(user, 'is_email_verified'):
            user.is_email_verified = True
            user.save()

        self.stdout.write(self.style.SUCCESS(
            f'Superuser {email} created successfully!'))
