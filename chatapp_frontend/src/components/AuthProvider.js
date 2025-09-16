import React, { useState, useEffect, createContext } from "react";
import ApiService from "../services/ApiService";

export const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem("access_token");

  useEffect(() => {
    if (token) {
      ApiService.get("/auth/profile/")
        .then(setUser)
        .catch(() => {
          console.log("Invalid token, logging out");
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (email, password) => {
    const data = await ApiService.post("/auth/login/", { email, password });
    // data = await response.json();
    return data;
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
    <AuthContext.Provider value={{ user, setUser, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
