from django.urls import path
from . import views

urlpatterns = [
    path("register/", views.RegisterView.as_view(), name='register'),
    path("login/", views.LoginView.as_view(), name='login'),
    path("logout/", views.LogoutView.as_view(), name='logout'),
    path("token/refresh/", views.RefreshTokenView.as_view(), name='token_refresh'),

    path("email/verify/", views.EmailVerificationView.as_view(), name='verify-email'),
    path("email/resend/", views.ResendEmailVerificationView.as_view(),
         name='resend-verification'),

    path("password/change/", views.PasswordChangeView.as_view(),
         name='password-change'),
    path("password/reset/", views.PasswordResetView.as_view(), name='password-reset'),
    path("password/reset/confirm/",
         views.PasswordResetConfirmView.as_view(), name='reset-confirm'),

    path('2fa/enable/', views.Enable2FAView.as_view(), name='enable_2fa'),
    path('2fa/disable/', views.Disable2FAView.as_view(), name='disable_2fa'),
    path('2fa/verify/', views.Verify2FAView.as_view(), name='verify_2fa'),

    path('profile/', views.UserRetrieveUpdateView.as_view(), name='user-profile'),
    path('profile/update/', views.UserRetrieveUpdateView.as_view(),
         name='profile-update')
]
