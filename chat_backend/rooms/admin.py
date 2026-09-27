from django.contrib import admin
from .models import Room, RoomMembership, RoomInvite, RoomMessage

admin.site.register(Room)
admin.site.register(RoomMembership)
admin.site.register(RoomInvite)
admin.site.register(RoomMessage)
