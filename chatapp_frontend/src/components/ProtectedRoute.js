import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import useAuthStore from "../store/authStore";
import { Spinner } from "./ui";

export default function ProtectedRoute({ children }) {
  const { user } = useAuthStore();
  const token = localStorage.getItem("access_token");

  if (!user && !token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
