from django.contrib import admin
from .models import DirectMessage, DirectConversation

admin.site.register(DirectMessage)
admin.site.register(DirectConversation)
