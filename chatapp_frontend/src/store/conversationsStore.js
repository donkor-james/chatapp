import { create } from "zustand";
import { conversationsAPI } from "../api/services";

const useConversationsStore = create((set, get) => ({
  conversations: [],
  activeConversation: null,
  messages: {}, // { [conversationId]: Message[] }
  loading: false,

  fetchConversations: async () => {
    set({ loading: true });
    try {
      const { data } = await conversationsAPI.list();
      set({ conversations: data, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  startConversation: async (userId) => {
    try {
      const { data } = await conversationsAPI.start(userId);
      set((s) => ({
        conversations: s.conversations.find((c) => c.id === data.id)
          ? s.conversations
          : [data, ...s.conversations],
        activeConversation: data,
      }));
      return { data };
    } catch (err) {
      return { error: err.response?.data };
    }
  },

  setActiveConversation: (conv) => set({ activeConversation: conv }),

  fetchMessages: async (conversationId) => {
    try {
      const { data } = await conversationsAPI.messages(conversationId);
      set((s) => ({ messages: { ...s.messages, [conversationId]: data } }));
    } catch {}
  },

  sendMessage: async (conversationId, content) => {
    try {
      const { data } = await conversationsAPI.send(conversationId, content);
      // set((s) => ({
      //   messages: {
      //     ...s.messages,
      //     [conversationId]: [...(s.messages[conversationId] || []), data],
      //   },
      //   conversations: s.conversations.map((c) =>
      //     c.id === conversationId
      //       ? { ...c, last_message: data, last_message_at: data.created_at }
      //       : c
      //   ),
      // }));
      return { data };
    } catch (err) {
      return { error: err.response?.data };
    }
  },

  // Called by WebSocket
  receiveMessage: (conversationId, message) => {
    set((s) => {
      const existing = s.messages[conversationId] || [];
      const alreadyIn = existing.some((m) => m.id === message.id);
      return {
        messages: {
          ...s.messages,
          [conversationId]: alreadyIn ? existing : [...existing, message],
        },
        conversations: s.conversations.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                last_message: message,
                last_message_at: message.created_at,
                unread_count:
                  s.activeConversation?.id === conversationId
                    ? 0
                    : (c.unread_count || 0) + 1,
              }
            : c,
        ),
      };
    });
  },

  // Called by WebSocket for edits/deletes
  updateMessage: (conversationId, message) => {
    set((s) => {
      const existing = s.messages[conversationId] || [];
      return {
        messages: {
          ...s.messages,
          [conversationId]: existing.map((m) =>
            m.id === message.id ? message : m,
          ),
        },
        // Keep the inbox preview in sync if the edited/deleted message
        // was the conversation's last message
        conversations: s.conversations.map((c) =>
          c.id === conversationId && c.last_message?.id === message.id
            ? { ...c, last_message: message }
            : c,
        ),
      };
    });
  },

  clearUnread: (conversationId) => {
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId ? { ...c, unread_count: 0 } : c,
      ),
    }));
  },

  totalUnread: () =>
    get().conversations.reduce((n, c) => n + (c.unread_count || 0), 0),
}));

export default useConversationsStore;
