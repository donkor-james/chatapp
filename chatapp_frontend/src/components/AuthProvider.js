import React, { useState, useEffect, createContext } from "react";
import ApiService from "../services/ApiService";

export const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token) {
      ApiService.get("/auth/profile/")
        .then(setUser)
        .catch(() => {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const data = await ApiService.post("/auth/login/", { email, password });
    if (data.requires_2fa) {
      return {
        requires2fa: true,
        tempToken: data.temp_token,
        message: data.message,
      };
    }
    if (data.access_token && data.refresh_token) {
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      const userProfile = await ApiService.get("/auth/profile/");
      setUser(userProfile);
      return { success: true, message: data.message };
    }
    // Handle error response from backend
    if (data.error) {
      throw data.error;
    }
    // If message exists, return it (for 2FA or other info)
    if (data.message) {
      return { message: data.message, temp_token: data.temp_token };
    }
    throw new Error("Login failed");
  };

  const logout = async () => {
    try {
      await ApiService.post("/auth/logout/", {
        refresh_token: localStorage.getItem("refresh_token"),
      });
    } catch (error) {
      console.error("Logout error:", error);
    }
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
