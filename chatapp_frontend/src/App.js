import logo from "./logo.svg";
import "./App.css";

import React, { useContext } from "react";
import { AuthContext } from "./components/AuthProvider";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Login from "./components/Login";
import Register from "./components/Register";
import PasswordResetRequest from "./components/PasswordResetRequest";
import PasswordResetConfirm from "./components/PasswordResetConfirm";
import EmailVerification from "./components/EmailVerification";
import ResendVerification from "./components/ResendVerification";
import ChatApp from "./components/ChatApp";
import Contacts from "./components/Contacts";
import Profile from "./components/Profile";
import Notifications from "./components/Notifications";

const App = () => {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

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
        <Route path="/verify-email/" element={<EmailVerification />} />
        <Route path="/resend-verification" element={<ResendVerification />} />

        {/* Protected routes */}
        <Route
          path="/"
          element={user ? <ChatApp /> : <Navigate to="/login" />}
        />
        <Route
          path="/contacts"
          element={user ? <Contacts /> : <Navigate to="/login" />}
        />
        <Route
          path="/profile"
          element={user ? <Profile /> : <Navigate to="/login" />}
        />
        <Route
          path="/notifications"
          element={user ? <Notifications /> : <Navigate to="/login" />}
        />
        {/* Add more feature pages as needed */}
      </Routes>
    </Router>
  );
};

export default App;
