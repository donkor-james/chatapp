from django.test import TestCase
from django.test import override_settings
from rest_framework.test import APITestCase
from rest_framework import status
from unittest.mock import patch
from .models import User
from .utils import send_verification_email


class RegistrationTests(APITestCase):
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


class LoginTests(APITestCase):
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


class EmailUtilsTests(TestCase):
    @override_settings(RESEND_API_KEY=None)
    @patch('accounts.utils.resend.Emails.send')
    def test_send_verification_email_skips_external_call_without_api_key(self, mock_send):
        user = User.objects.create_user(
            email='dave@example.com',
            username='dave',
            first_name='Dave',
            password='Pass123!'
        )
        send_verification_email(user)
        mock_send.assert_not_called()
