from django.urls import path
from . import views

app_name = 'conversations'

urlpatterns = [
    path('', views.ConversationListView.as_view(), name='conversation_list'),
    path('start/', views.GetOrCreateConversationView.as_view(),
         name='start_conversation'),
    path('<uuid:id>/', views.ConversationDetailView.as_view(),
         name='conversation_detail'),
    path('<uuid:conversation_id>/messages/',
         views.MessageListView.as_view(), name='conversation_messages'),
    path('<uuid:conversation_id>/messages/send/',
         views.SendMessageView.as_view(), name='send_message'),
    path('<uuid:conversation_id>/messages/<uuid:message_id>/',
         views.DirectMessageDetailView.as_view(), name='message_details'),
]
