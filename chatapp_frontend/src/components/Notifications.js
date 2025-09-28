import React, { useState, useEffect } from "react";
import ApiService from "../services/ApiService";
import {
  MessageCircle,
  UserPlus,
  UserCheck,
  Mail,
  Bell,
  X,
} from "lucide-react";

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchNotificationsAndMarkAsRead();
  }, []);

  const fetchNotificationsAndMarkAsRead = async () => {
    try {
      setLoading(true);
      const data = await ApiService.get("/notifications/");

      // Filter out message notifications - we don't want to show them in the notification panel
      const filteredNotifications = (data || []).filter(
        (notif) => notif.notification_type !== "message"
      );

      setNotifications(filteredNotifications);

      // Automatically mark all notifications as read when opening the modal
      const hasUnreadNotifications =
        data && data.some((notif) => !notif.is_read);
      if (hasUnreadNotifications) {
        await markAllAsRead();
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
      setError("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  const markAllAsRead = async () => {
    try {
      await ApiService.post("/notifications/mark-all-read/");
      setNotifications((prev) =>
        prev.map((notif) => ({ ...notif, is_read: true }))
      );
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case "message":
        return <MessageCircle className="h-5 w-5 text-blue-500" />;
      case "friend_request":
        return <UserPlus className="h-5 w-5 text-green-500" />;
      case "friend_accepted":
        return <UserCheck className="h-5 w-5 text-green-600" />;
      case "chat_invite":
        return <Mail className="h-5 w-5 text-purple-500" />;
      default:
        return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  if (loading) {
    return (
      <div className="w-full text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
        <p className="text-gray-500 mt-2">Loading notifications...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full text-center py-8">
        <p className="text-red-500">{error}</p>
        <button
          onClick={fetchNotificationsAndMarkAsRead}
          className="mt-2 text-blue-500 hover:text-blue-700"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Notifications</h2>
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-8">
          <Bell className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">You have no notifications.</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className="p-4 rounded-lg border bg-gray-50 border-gray-200 transition-colors"
            >
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-1">
                  {getNotificationIcon(notification.notification_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {notification.title}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {notification.message}
                      </p>
                      {notification.sender && (
                        <p className="text-xs text-gray-500 mt-1">
                          From: {notification.sender.username}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <span className="text-xs text-gray-500">
                        {formatTime(notification.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Notifications;
