from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from .models import Notification
from .serializers import NotificationSerializer


class NotificationListView(generics.ListAPIView):
    """Get user's notifications"""
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user).select_related('sender')


class MarkNotificationReadView(APIView):
    """Mark notification as read"""
    permission_classes = [IsAuthenticated]

    def post(self, request, notification_id):
        notification = get_object_or_404(
            Notification,
            id=notification_id,
            recipient=request.user
        )

        notification.is_read = True
        notification.save()

        return Response(
            {'message': 'Notification marked as read'},
            status=status.HTTP_200_OK
        )


class MarkAllNotificationsReadView(APIView):
    """Mark all notifications as read"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        Notification.objects.filter(
            recipient=request.user,
            is_read=False
        ).update(is_read=True)

        return Response(
            {'message': 'All notifications marked as read'},
            status=status.HTTP_200_OK
        )


class UnreadNotificationCountView(APIView):
    """Get count of unread notifications"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        count = Notification.objects.filter(
            recipient=request.user,
            is_read=False
        ).count()

        return Response({'unread_count': count}, status=status.HTTP_200_OK)
