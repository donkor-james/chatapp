from django.urls import path
from . import views

app_name = 'chats'

urlpatterns = [
    path('', views.ChatListView.as_view(), name='chat_list'),
    path('create/', views.CreateChatView.as_view(), name='create_chat'),
    path('<int:pk>/', views.ChatDetailView.as_view(), name='chat_detail'),
    path('<int:chat_id>/messages/',
         views.ChatMessagesView.as_view(), name='chat_messages'),
    path('<int:chat_id>/messages/<uuid:message_id>/read/',
         views.MarkMessageReadView.as_view(), name='mark_message_read'),
]
