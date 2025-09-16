from . import views
from django.urls import path
from django.contrib import admin
from django.urls import path, include

from django.contrib import admin
from django.urls import path, include

app_name = 'contacts'

urlpatterns = [
    path('', views.ContactListView.as_view(), name='contact_list'),
    path('requests/', views.FriendRequestListView.as_view(),
         name='friend_request_list'),
    path('requests/send/', views.SendFriendRequestView.as_view(),
         name='send_friend_request'),
    path('requests/<int:request_id>/accept/',
         views.AcceptFriendRequestView.as_view(), name='accept_friend_request'),
    path('requests/<int:request_id>/decline/',
         views.DeclineFriendRequestView.as_view(), name='decline_friend_request'),
    path('block/<int:user_id>/', views.BlockUserView.as_view(), name='block_user'),
    path('unblock/<int:user_id>/',
         views.UnblockUserView.as_view(), name='unblock_user'),
    path('start-chat/', views.StartChatWithContactView.as_view(),
         name='start_chat_with_contact'),
]
