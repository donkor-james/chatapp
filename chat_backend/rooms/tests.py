from rest_framework.test import APITestCase
from rest_framework import status
from accounts.models import User
from .models import Room, RoomMembership, RoomMessage


class RoomCreationTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='host@example.com', username='host', password='Pass123!',
            is_email_verified=True,
        )
        self.client.force_authenticate(user=self.user)

    def test_create_room_makes_creator_the_host_member(self):
        response = self.client.post('/api/rooms/create/', {
            'topic': 'Test Room', 'description': 'A room',
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        room = Room.objects.get(id=response.data['id'])
        self.assertEqual(room.host, self.user)
        membership = RoomMembership.objects.get(room=room, user=self.user)
        self.assertEqual(membership.role, RoomMembership.Role.HOST)

    def test_unauthenticated_cannot_create_room(self):
        self.client.force_authenticate(user=None)
        response = self.client.post('/api/rooms/create/', {'topic': 'X'})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class RoomMessagePermissionTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email='owner@example.com', username='owner', password='Pass123!',
            is_email_verified=True,
        )
        self.intruder = User.objects.create_user(
            email='intruder@example.com', username='intruder', password='Pass123!',
            is_email_verified=True,
        )
        self.room = Room.objects.create(
            topic='Room', host=self.owner, status=Room.Status.ACTIVE,
        )
        RoomMembership.objects.create(
            room=self.room, user=self.owner, role=RoomMembership.Role.HOST,
        )
        RoomMembership.objects.create(
            room=self.room, user=self.intruder, role=RoomMembership.Role.MEMBER,
        )
        self.message = RoomMessage.objects.create(
            room=self.room, sender=self.owner, content='Original text',
        )

    def _detail_url(self):
        return f'/api/rooms/{self.room.id}/messages/{self.message.id}/'

    def test_sender_can_edit_own_message(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.patch(self._detail_url(), {'content': 'Edited'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.message.refresh_from_db()
        self.assertEqual(self.message.content, 'Edited')
        self.assertTrue(self.message.is_edited)

    def test_non_sender_cannot_edit_message(self):
        self.client.force_authenticate(user=self.intruder)
        response = self.client.patch(self._detail_url(), {'content': 'Hacked'})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.message.refresh_from_db()
        self.assertEqual(self.message.content, 'Original text')

    def test_edit_with_empty_content_rejected(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.patch(self._detail_url(), {'content': '   '})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_sender_can_delete_own_message_softly(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.delete(self._detail_url())
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.message.refresh_from_db()
        self.assertTrue(self.message.is_deleted)
        self.assertEqual(self.message.content, '')
        # Soft delete: row still exists
        self.assertTrue(
            RoomMessage.objects.filter(id=self.message.id).exists()
        )

    def test_non_sender_cannot_delete_message(self):
        self.client.force_authenticate(user=self.intruder)
        response = self.client.delete(self._detail_url())
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.message.refresh_from_db()
        self.assertFalse(self.message.is_deleted)

    def test_non_member_cannot_view_messages(self):
        outsider = User.objects.create_user(
            email='outsider@example.com', username='outsider', password='Pass123!',
            is_email_verified=True,
        )
        self.client.force_authenticate(user=outsider)
        response = self.client.get(f'/api/rooms/{self.room.id}/messages/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)  # empty queryset, not an error
