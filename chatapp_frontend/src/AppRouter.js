import React, { useContext } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthContext } from "./components/AuthProvider";
import ChatApp from "./components/ChatApp";
import Login from "./components/Login";
import Register from "./components/Register";
import PasswordResetRequest from "./components/PasswordResetRequest";
import PasswordResetConfirm from "./components/PasswordResetConfirm";
import EmailVerification from "./components/EmailVerification";
import ResendVerification from "./components/ResendVerification";

const AppRouter = () => {
  const { user } = useContext(AuthContext);
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
        <Route
          path="*"
          element={<Navigate to={user ? "/chats" : "/login"} />}
        />
      </Routes>
    </Router>
  );
};

export default AppRouter;
