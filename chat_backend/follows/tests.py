# follows/tests.py
from rest_framework.test import APITestCase
from rest_framework import status
from accounts.models import User
from .models import Follow, Block


def make_user(email, username):
    user = User.objects.create_user(
        email=email, username=username, password='Pass123!')
    user.is_email_verified = True
    user.save()
    return user


class FollowTests(APITestCase):
    def setUp(self):
        self.alice = make_user('alice@example.com', 'alice')
        self.bob = make_user('bob@example.com', 'bob')
        self.client.force_authenticate(user=self.alice)

    def test_follow_creates_relationship(self):
        response = self.client.post(
            '/api/following/follow/', {'user_id': str(self.bob.id)})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Follow.objects.filter(
            follower=self.alice, followee=self.bob).exists())

    def test_follow_twice_is_idempotent(self):
        self.client.post('/api/following/follow/',
                         {'user_id': str(self.bob.id)})
        response = self.client.post(
            '/api/following/follow/', {'user_id': str(self.bob.id)})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(Follow.objects.filter(
            follower=self.alice, followee=self.bob).count(), 1)

    def test_unfollow_removes_relationship(self):
        Follow.objects.create(follower=self.alice, followee=self.bob)
        response = self.client.delete(
            f'/api/following/unfollow/{self.bob.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Follow.objects.filter(
            follower=self.alice, followee=self.bob).exists())

    def test_unfollow_nonexistent_returns_404(self):
        response = self.client.delete(
            f'/api/following/unfollow/{self.bob.id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class BlockTests(APITestCase):
    def setUp(self):
        self.alice = make_user('alice@example.com', 'alice')
        self.bob = make_user('bob@example.com', 'bob')
        self.client.force_authenticate(user=self.alice)

    def test_block_creates_relationship(self):
        response = self.client.post(f'/api/following/block/{self.bob.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(Block.objects.filter(
            blocker=self.alice, blocked=self.bob).exists())

    def test_cannot_block_self(self):
        response = self.client.post(f'/api/following/block/{self.alice.id}/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_block_removes_existing_follow_both_directions(self):
        Follow.objects.create(follower=self.alice, followee=self.bob)
        Follow.objects.create(follower=self.bob, followee=self.alice)
        self.client.post(f'/api/following/block/{self.bob.id}/')
        self.assertFalse(Follow.objects.filter(
            follower=self.alice, followee=self.bob).exists())
        self.assertFalse(Follow.objects.filter(
            follower=self.bob, followee=self.alice).exists())

    def test_unblock_removes_relationship(self):
        Block.objects.create(blocker=self.alice, blocked=self.bob)
        response = self.client.delete(f'/api/following/unblock/{self.bob.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Block.objects.filter(
            blocker=self.alice, blocked=self.bob).exists())


class DiscoveryTests(APITestCase):
    def setUp(self):
        self.alice = make_user('alice@example.com', 'alice')
        self.bob = make_user('bob@example.com', 'bob')
        self.carol = make_user('carol@example.com', 'carol')
        self.client.force_authenticate(user=self.alice)

    def test_discover_excludes_self(self):
        response = self.client.get('/api/following/discover/')
        ids = [u['id'] for u in response.data]
        self.assertNotIn(str(self.alice.id), ids)

    def test_discover_excludes_already_followed(self):
        Follow.objects.create(follower=self.alice, followee=self.bob)
        response = self.client.get('/api/following/discover/')
        ids = [str(u['id']) for u in response.data]
        self.assertNotIn(str(self.bob.id), ids)
        self.assertIn(str(self.carol.id), ids)

    def test_discover_excludes_blocked_in_either_direction(self):
        Block.objects.create(blocker=self.alice, blocked=self.bob)
        Block.objects.create(blocker=self.carol, blocked=self.alice)
        response = self.client.get('/api/following/discover/')
        ids = [str(u['id']) for u in response.data]
        self.assertNotIn(str(self.bob.id), ids)
        self.assertNotIn(str(self.carol.id), ids)


class FollowStatsTests(APITestCase):
    def setUp(self):
        self.alice = make_user('alice@example.com', 'alice')
        self.bob = make_user('bob@example.com', 'bob')
        self.client.force_authenticate(user=self.alice)

    def test_stats_reflect_mutual_follow_state(self):
        Follow.objects.create(follower=self.alice, followee=self.bob)
        response = self.client.get(
            f'/api/following/users/{self.bob.id}/stats/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['you_follow_them'])
        self.assertFalse(response.data['they_follow_you'])
        self.assertEqual(response.data['followers_count'], 1)
