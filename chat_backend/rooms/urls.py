from django.urls import path
from . import views

app_name = 'rooms'

urlpatterns = [
    path('', views.RoomListView.as_view(), name='room_list'),
    path('create/', views.CreateRoomView.as_view(), name='create_room'),
    path('<uuid:id>/', views.RoomDetailView.as_view(), name='room_detail'),
    path('<uuid:room_id>/messages/',
         views.RoomMessageListView.as_view(), name='room_messages'),
    path('<uuid:room_id>/messages/send/',
         views.SendRoomMessageView.as_view(), name='send_room_message'),
    path('<uuid:room_id>/messages/<uuid:message_id>/',
         views.RoomMessageDetailView.as_view(), name='room_message_detail'),
    path('<uuid:room_id>/leave/', views.LeaveRoomView.as_view(), name='leave_room'),
    path('<uuid:room_id>/end/', views.EndRoomView.as_view(), name='end_room'),
    path('<uuid:room_id>/dm-with/<uuid:user_id>/',
         views.StartDMFromRoomView.as_view(), name='start_dm'),
    path('join/<str:invite_token>/',
         views.JoinRoomViaLinkView.as_view(), name='join_room'),
]
