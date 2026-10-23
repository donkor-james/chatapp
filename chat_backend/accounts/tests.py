import secrets
from unittest.mock import patch
from django.test import TestCase
from rest_framework.test import APITestCase
from rest_framework import status
from .models import User

# Generated on every run, so no password literal is committed
TEST_PASSWORD = f"{secrets.token_urlsafe(12)}Aa1!"


class MockedEmailTestCase(APITestCase):
    """Keeps tests from calling the real Resend API."""

    def setUp(self):
        super().setUp()
        for name in ('send_verification_email',
                     'send_2FA_code_email',
                     'send_reset_password_email'):
            patcher = patch(f'accounts.views.{name}')
            setattr(self, f'mock_{name}', patcher.start())
            self.addCleanup(patcher.stop)


class RegistrationTests(MockedEmailTestCase):
    def setUp(self):
        self.url = '/api/auth/register/'
        self.payload = {
            'email': 'alice@example.com',
            'username': 'alice',
            'first_name': 'Alice',
            'last_name': 'Smith',
            'password': TEST_PASSWORD,
            'confirm_password': TEST_PASSWORD,
        }

    def test_register_success(self):
        response = self.client.post(self.url, self.payload)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user = User.objects.get(email='alice@example.com')
        self.assertFalse(user.is_email_verified)
        self.assertTrue(user.check_password(TEST_PASSWORD))

    def test_register_password_mismatch_returns_400(self):
        self.payload['confirm_password'] = TEST_PASSWORD + 'mismatch'
        response = self.client.post(self.url, self.payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_duplicate_email_returns_400(self):
        User.objects.create_user(
            email='alice@example.com', username='existing', password=TEST_PASSWORD,
        )
        response = self.client.post(self.url, self.payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class LoginTests(MockedEmailTestCase):
    def setUp(self):
        self.url = '/api/auth/login/'
        self.user = User.objects.create_user(
            email='bob@example.com', username='bob', password=TEST_PASSWORD,
        )
        self.user.is_email_verified = True
        self.user.save()

    def test_login_success_returns_tokens_and_user(self):
        response = self.client.post(self.url, {
            'email': 'bob@example.com', 'password': TEST_PASSWORD,
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access_token', response.data)
        self.assertIn('refresh_token', response.data)
        self.assertEqual(response.data['user']
                         ['id'], self.user.id)
        self.assertEqual(response.data['user']['email'], 'bob@example.com')

    def test_login_wrong_password_returns_400(self):
        response = self.client.post(self.url, {
            'email': 'bob@example.com', 'password': TEST_PASSWORD + 'wrong',
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_unverified_email_rejected(self):
        self.user.is_email_verified = False
        self.user.save()
        response = self.client.post(self.url, {
            'email': 'bob@example.com', 'password': TEST_PASSWORD,
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_with_2fa_enabled_requires_verification(self):
        self.user.two_factor_enabled = True
        self.user.save()
        response = self.client.post(self.url, {
            'email': 'bob@example.com', 'password': TEST_PASSWORD,
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['requires_2fa'])
        self.assertIn('temp_token', response.data)
        self.assertNotIn('access_token', response.data)


class ProfileTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='carol@example.com', username='carol', password=TEST_PASSWORD,
        )
        self.user.is_email_verified = True
        self.user.save()
        self.client.force_authenticate(user=self.user)

    def test_profile_never_exposes_password_hash(self):
        response = self.client.get('/api/auth/profile/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn('password', response.data)

    def test_unauthenticated_profile_request_rejected(self):
        self.client.force_authenticate(user=None)
        response = self.client.get('/api/auth/profile/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
