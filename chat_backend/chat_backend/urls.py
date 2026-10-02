from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/rooms/', include('rooms.urls')),
    path('api/conversations/', include('conversations.urls')),
    path('api/following/', include('follows.urls')),
    path('api/notifications/', include('notifications.urls')),
]
