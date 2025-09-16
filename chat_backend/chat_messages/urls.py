from . import views
from django.urls import path
from django.contrib import admin


app_name = 'messages'

urlpatterns = [
    path('<uuid:pk>/', views.MessageDetailView.as_view(), name='message_detail'),
]
