import React, { useContext, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthContext } from "./components/AuthProvider";
import ApiService from "./services/ApiService";
import ChatApp from "./components/ChatApp";
import Login from "./components/Login";
import Register from "./components/Register";
import PasswordResetRequest from "./components/PasswordResetRequest";
import PasswordResetConfirm from "./components/PasswordResetConfirm";
import EmailVerification from "./components/EmailVerification";
import ResendVerification from "./components/ResendVerification";
import Notifications from "./components/Notifications";

const AppRouter = () => {
  const { user, setUser, setLoading } = useContext(AuthContext);
  const token = localStorage.getItem("access_token");

  useEffect(() => {
    setLoading(true);
    if (token) {
      ApiService.get("/auth/profile/")
        .then(setUser)
        .catch(() => {
          console.log("Invalid token, logging out");
          alert("logging out");
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/password-reset" element={<PasswordResetRequest />} />
        <Route
          path="/password-reset/confirm/:token"
          element={<PasswordResetConfirm />}
        />
        <Route path="/verify-email" element={<EmailVerification />} />
        <Route path="/resend-verification" element={<ResendVerification />} />

        {/* Protected routes */}
        <Route
          path="/chats/:chatId?"
          element={user ? <ChatApp /> : <Navigate to="/login" />}
        />
        <Route
          path="/contacts"
          element={
            user ? <ChatApp activeView="contacts" /> : <Navigate to="/login" />
          }
        />
        {/* Notifications route removed: now handled as overlay in ChatApp */}
        <Route
          path="*"
          element={<Navigate to={user ? "/chats" : "/login"} />}
        />
      </Routes>
    </Router>
  );
};

export default AppRouter;
