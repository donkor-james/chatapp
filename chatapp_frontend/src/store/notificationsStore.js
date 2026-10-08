import { create } from "zustand";
import { notificationsAPI } from "../api/services";

const useNotificationsStore = create((set, get) => ({
  notifications: [],
  loading: false,

  fetchNotifications: async () => {
    set({ loading: true });
    try {
      const { data } = await notificationsAPI.list();
      set({ notifications: data, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  // Called by the WebSocket when a new notification is pushed
  receiveNotification: (notification) =>
    set((s) =>
      s.notifications.some((n) => n.id === notification.id)
        ? s
        : {
            notifications: [
              { is_read: false, ...notification },
              ...s.notifications,
            ],
          },
    ),

  markRead: async (id) => {
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, is_read: true } : n,
      ),
    }));
    try {
      await notificationsAPI.markRead(id);
    } catch {
      get().fetchNotifications();
    }
  },

  markAllRead: async () => {
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, is_read: true })),
    }));
    try {
      await notificationsAPI.markAllRead();
    } catch {
      get().fetchNotifications();
    }
  },
}));

export default useNotificationsStore;
