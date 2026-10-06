import { create } from "zustand";
import { authAPI } from "../api/services";

const useAuthStore = create((set, get) => ({
  user: null,
  loading: false,
  error: null,
  isHydrated: false,

  init: async () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      set({ isHydrated: true });
      return;
    }
    try {
      const { data } = await authAPI.getProfile();
      set({ user: data, isHydrated: true });
    } catch (err) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      set({ user: null, isHydrated: true });
    }
  },

  login: async (credentials) => {
    set({ loading: true, error: null });
    try {
      const { data } = await authAPI.login(credentials);

      if (data.requires_2fa) {
        set({ loading: false });
        return { requires2FA: true, tempToken: data.temp_token };
      }

      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      set({ user: data.user, loading: false });
      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.error || "Login failed.";
      set({ error: msg, loading: false });
      return { error: msg };
    }
  },

  verify2FA: async ({ code, tempToken }) => {
    set({ loading: true, error: null });
    try {
      const { data } = await authAPI.verify2FA({ code, temp_token: tempToken });
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      set({ user: data.user, loading: false });
      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.error || "2FA verification failed.";
      set({ error: msg, loading: false });
      return { error: msg };
    }
  },

  register: async (data) => {
    set({ loading: true, error: null });
    try {
      await authAPI.register(data);
      set({ loading: false });
      return { success: true };
    } catch (err) {
      const errors = err.response?.data;
      const msg =
        typeof errors === "string"
          ? errors
          : Object.values(errors || {}).flat()[0] || "Registration failed.";
      set({ error: msg, loading: false });
      return { error: msg };
    }
  },

  logout: async () => {
    const refresh = localStorage.getItem("refresh_token");
    try {
      await authAPI.logout({ refresh });
    } catch {}
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    set({ user: null });
  },

  fetchProfile: async () => {
    try {
      const { data } = await authAPI.getProfile();
      set({ user: data });
    } catch {}
  },

  updateProfile: async (formData) => {
    try {
      const { data } = await authAPI.updateProfile(formData);
      set({ user: data });
      return { success: true };
    } catch (err) {
      return { error: err.response?.data };
    }
  },

  clearError: () => set({ error: null }),
}));

export default useAuthStore;
