from django.urls import path
from . import views

app_name = 'notifications'

urlpatterns = [
    path('', views.NotificationListView.as_view(), name='notification_list'),
    path('<uuid:notification_id>/read/',
         views.MarkNotificationReadView.as_view(), name='mark_notification_read'),
    path('mark-all-read/', views.MarkAllNotificationsReadView.as_view(),
         name='mark_all_read'),
    path('unread-count/', views.UnreadNotificationCountView.as_view(),
         name='unread_count'),
]
