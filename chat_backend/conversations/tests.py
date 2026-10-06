from rest_framework.test import APITestCase
from rest_framework import status
from accounts.models import User
from .models import DirectConversation, DirectMessage


class ConversationTests(APITestCase):
    def setUp(self):
        self.alice = User.objects.create_user(
            email='alice@example.com', username='alice', password='Pass123!',
            is_email_verified=True,
        )
        self.bob = User.objects.create_user(
            email='bob@example.com', username='bob', password='Pass123!',
            is_email_verified=True,
        )
        self.client.force_authenticate(user=self.alice)

    def test_start_conversation_creates_pair(self):
        response = self.client.post('/api/conversations/start/', {
            'user_id': str(self.bob.id),
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            DirectConversation.objects.filter(
                participant_a__in=[self.alice, self.bob],
                participant_b__in=[self.alice, self.bob],
            ).exists()
        )

    def test_start_conversation_twice_returns_same_conversation(self):
        first = self.client.post(
            '/api/conversations/start/', {'user_id': str(self.bob.id)})
        second = self.client.post(
            '/api/conversations/start/', {'user_id': str(self.bob.id)})
        self.assertEqual(first.data['id'], second.data['id'])
        self.assertEqual(DirectConversation.objects.count(), 1)

    def test_cannot_start_conversation_with_self(self):
        response = self.client.post('/api/conversations/start/', {
            'user_id': str(self.alice.id),
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class DirectMessagePermissionTests(APITestCase):
    def setUp(self):
        self.alice = User.objects.create_user(
            email='alice@example.com', username='alice', password='Pass123!',
            is_email_verified=True,
        )
        self.bob = User.objects.create_user(
            email='bob@example.com', username='bob', password='Pass123!',
            is_email_verified=True,
        )
        self.stranger = User.objects.create_user(
            email='stranger@example.com', username='stranger', password='Pass123!',
            is_email_verified=True,
        )
        self.conversation, _ = DirectConversation.get_or_create_for(
            self.alice, self.bob)
        self.message = DirectMessage.objects.create(
            conversation=self.conversation, sender=self.alice, content='Hi Bob',
        )

    def _detail_url(self):
        return f'/api/conversations/{self.conversation.id}/messages/{self.message.id}/'

    def test_sender_can_edit_own_message(self):
        self.client.force_authenticate(user=self.alice)
        response = self.client.patch(self._detail_url(), {'content': 'Edited'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.message.refresh_from_db()
        self.assertTrue(self.message.is_edited)

    def test_recipient_cannot_edit_senders_message(self):
        self.client.force_authenticate(user=self.bob)
        response = self.client.patch(self._detail_url(), {'content': 'Hacked'})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_sender_can_soft_delete_own_message(self):
        self.client.force_authenticate(user=self.alice)
        response = self.client.delete(self._detail_url())
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.message.refresh_from_db()
        self.assertTrue(self.message.is_deleted)
        self.assertEqual(self.message.content, '')

    def test_non_participant_cannot_list_messages(self):
        self.client.force_authenticate(user=self.stranger)
        response = self.client.get(
            f'/api/conversations/{self.conversation.id}/messages/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
