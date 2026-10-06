import client from "./client";

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authAPI = {
  register: (data) => client.post("/auth/register/", data),
  login: (data) => client.post("/auth/login/", data),
  logout: (data) => client.post("/auth/logout/", data),
  verify2FA: (data) => client.post("/auth/2fa/verify/", data),
  getProfile: () => client.get("/auth/profile/"),
  updateProfile: (data) => client.patch("/auth/profile/update/", data),
  refreshToken: (refresh) => client.post("/auth/token/refresh/", { refresh }),
};

// ── Rooms ─────────────────────────────────────────────────────────────────────
export const roomsAPI = {
  list: () => client.get("/rooms/"),
  create: (data) => client.post("/rooms/create/", data),
  detail: (id) => client.get(`/rooms/${id}/`),
  join: (token) => client.post(`/rooms/join/${token}/`),
  messages: (roomId) => client.get(`/rooms/${roomId}/messages/`),
  sendMessage: (roomId, content) =>
    client.post(`/rooms/${roomId}/messages/send/`, { content }),
  editMessage: (roomId, messageId, content) =>
    client.patch(`/rooms/${roomId}/messages/${messageId}/`, { content }),
  deleteMessage: (roomId, messageId) =>
    client.delete(`/rooms/${roomId}/messages/${messageId}/`),
  leave: (id) => client.post(`/rooms/${id}/leave/`),
  end: (id) => client.post(`/rooms/${id}/end/`),
  startDM: (roomId, userId) =>
    client.post(`/rooms/${roomId}/dm-with/${userId}/`),
};

// ── Conversations ─────────────────────────────────────────────────────────────
export const conversationsAPI = {
  list: () => client.get("/conversations/"),
  start: (userId) => client.post("/conversations/start/", { user_id: userId }),
  detail: (id) => client.get(`/conversations/${id}/`),
  messages: (id) => client.get(`/conversations/${id}/messages/`),
  send: (id, content) =>
    client.post(`/conversations/${id}/messages/send/`, { content }),
  editMessage: (conversationId, messageId, content) =>
    client.patch(`/conversations/${conversationId}/messages/${messageId}/`, {
      content,
    }),
  deleteMessage: (conversationId, messageId) =>
    client.delete(`/conversations/${conversationId}/messages/${messageId}/`),
};

// ── Contacts / Follows ────────────────────────────────────────────────────────
export const contactsAPI = {
  follow: (userId) => client.post("/following/follow/", { user_id: userId }),
  unfollow: (userId) => client.delete(`/following/unfollow/${userId}/`),
  followers: (userId) => client.get(`/following/users/${userId}/followers/`),
  following: (userId) => client.get(`/following/users/${userId}/following/`),
  stats: (userId) => client.get(`/following/users/${userId}/stats/`),
  block: (userId) => client.post(`/following/block/${userId}/`),
  unblock: (userId) => client.delete(`/following/unblock/${userId}/`),
  discover: () => client.get("/following/discover/"),
};

// ── Notifications ─────────────────────────────────────────────────────────────
export const notificationsAPI = {
  list: () => client.get("/notifications/"),
  markRead: (id) => client.post(`/notifications/${id}/read/`),
  markAllRead: () => client.post("/notifications/mark-all-read/"),
  unreadCount: () => client.get("/notifications/unread-count/"),
};
