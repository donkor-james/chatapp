import { create } from 'zustand';
import { roomsAPI } from '../api/services';

const useRoomsStore = create((set, get) => ({
  rooms: [],
  activeRoom: null,
  loading: false,
  error: null,

  fetchRooms: async () => {
    set({ loading: true });
    try {
      const { data } = await roomsAPI.list();
      set({ rooms: data, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  createRoom: async (payload) => {
    try {
      const { data } = await roomsAPI.create(payload);
      set((s) => ({ rooms: [data, ...s.rooms], activeRoom: data }));
      return { data };
    } catch (err) {
      return { error: err.response?.data };
    }
  },

  joinRoom: async (inviteToken) => {
    try {
      const { data } = await roomsAPI.join(inviteToken);
      set((s) => ({
        rooms: s.rooms.find((r) => r.id === data.id)
          ? s.rooms.map((r) => (r.id === data.id ? data : r))
          : [data, ...s.rooms],
        activeRoom: data,
      }));
      return { data };
    } catch (err) {
      return { error: err.response?.data?.error || 'Could not join room.' };
    }
  },

  leaveRoom: async (roomId) => {
    try {
      await roomsAPI.leave(roomId);
      set((s) => ({
        rooms: s.rooms.filter((r) => r.id !== roomId),
        activeRoom: s.activeRoom?.id === roomId ? null : s.activeRoom,
      }));
      return { success: true };
    } catch (err) {
      return { error: err.response?.data };
    }
  },

  endRoom: async (roomId) => {
    try {
      await roomsAPI.end(roomId);
      set((s) => ({
        rooms: s.rooms.map((r) =>
          r.id === roomId ? { ...r, status: 'ended' } : r
        ),
        activeRoom: s.activeRoom?.id === roomId ? null : s.activeRoom,
      }));
      return { success: true };
    } catch (err) {
      return { error: err.response?.data };
    }
  },

  setActiveRoom: (room) => set({ activeRoom: room }),

  // Called by WebSocket events to update room state in real time
  handleMemberJoined: (roomId, user) => {
    set((s) => ({
      rooms: s.rooms.map((r) =>
        r.id === roomId
          ? {
              ...r,
              members: [...(r.members || []), { user, role: 'member', joined_at: new Date().toISOString() }],
              member_count: (r.member_count || 0) + 1,
            }
          : r
      ),
      activeRoom:
        s.activeRoom?.id === roomId
          ? {
              ...s.activeRoom,
              members: [...(s.activeRoom.members || []), { user, role: 'member', joined_at: new Date().toISOString() }],
              member_count: (s.activeRoom.member_count || 0) + 1,
            }
          : s.activeRoom,
    }));
  },

  handleMemberLeft: (roomId, userId) => {
    set((s) => ({
      rooms: s.rooms.map((r) =>
        r.id === roomId
          ? {
              ...r,
              members: (r.members || []).filter((m) => m.user.id !== userId),
              member_count: Math.max(0, (r.member_count || 1) - 1),
            }
          : r
      ),
      activeRoom:
        s.activeRoom?.id === roomId
          ? {
              ...s.activeRoom,
              members: (s.activeRoom.members || []).filter((m) => m.user.id !== userId),
              member_count: Math.max(0, (s.activeRoom.member_count || 1) - 1),
            }
          : s.activeRoom,
    }));
  },

  handleRoomEnded: (roomId) => {
    set((s) => ({
      rooms: s.rooms.map((r) =>
        r.id === roomId ? { ...r, status: 'ended' } : r
      ),
      activeRoom:
        s.activeRoom?.id === roomId
          ? { ...s.activeRoom, status: 'ended' }
          : s.activeRoom,
    }));
  },
}));

export default useRoomsStore;
