import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./styles/globals.css";
import useAuthStore from "./store/authStore";
import Layout from "./components/layout/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import DiscoverPage from "./pages/rooms/DiscoverPage";
import RoomPage from "./pages/rooms/RoomPage";
import JoinRoomPage from "./pages/rooms/JoinRoomPage";
import MessagesPage from "./pages/conversations/MessagesPage";
import PeoplePage from "./pages/people/PeoplePage";
import ProfilePage from "./pages/profile/ProfilePage";
import NotificationsPage from "./pages/notifications/NotificationsPage";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/join/:token"
        element={
          <ProtectedRoute>
            <JoinRoomPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout>
              <DiscoverPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/rooms/:id"
        element={
          <ProtectedRoute>
            <Layout>
              <RoomPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/messages"
        element={
          <ProtectedRoute>
            <Layout>
              <MessagesPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/people"
        element={
          <ProtectedRoute>
            <Layout>
              <PeoplePage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Layout>
              <ProfilePage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <Layout>
              <NotificationsPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  const { init, isHydrated } = useAuthStore();

  useEffect(() => {
    init();
  }, [init]);

  if (!isHydrated) {
    return null;
  }
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
