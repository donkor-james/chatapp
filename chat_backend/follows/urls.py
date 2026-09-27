from django.urls import path
from . import views


urlpatterns = [
    path('follow/', views.FollowView.as_view(), name='follow'),
    path('unfollow/<uuid:user_id>/', views.UnfollowView.as_view(), name='unfollow'),
    path('block/<uuid:user_id>/', views.BlockView.as_view(), name='block'),
    path('unblock/<uuid:user_id>/', views.UnblockView.as_view(), name='unblock'),
    path('discover/', views.UserDiscoveryView.as_view(), name='discover'),
    path('users/<uuid:user_id>/followers/',
         views.FollowersListView.as_view(), name='followers'),
    path('users/<uuid:user_id>/following/',
         views.FollowingListView.as_view(), name='following'),
    path('users/<uuid:user_id>/stats/',
         views.FollowStatsView.as_view(), name='follow_stats'),
]
