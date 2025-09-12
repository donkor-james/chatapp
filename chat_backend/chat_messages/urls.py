from . import views
from django.urls import path
from django.contrib import admin
from django.urls import path, include

from django.contrib import admin
from django.urls import path, include

app_name = 'messages'

urlpatterns = [
    path('<uuid:pk>/', views.MessageDetailView.as_view(), name='message_detail'),
]
