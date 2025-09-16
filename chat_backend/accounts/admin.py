from django.contrib import admin
from .models import User
from notifications.models import Notification
from contacts.models import Contact, FriendRequest, BlockedUser
from chat_messages.models import Message, MessageRead
from chats.models import Chat, ChatMembership

admin.site.register(User)
admin.site.register(Notification)
admin.site.register(Contact)
admin.site.register(FriendRequest)
admin.site.register(BlockedUser)
admin.site.register(Message)
admin.site.register(MessageRead)
admin.site.register(Chat)
admin.site.register(ChatMembership)
