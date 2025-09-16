import React from "react";
import AuthProvider from "./components/AuthProvider";
import AppRouter from "./AppRouter";

const Root = () => (
  <AuthProvider>
    <AppRouter />
  </AuthProvider>
);

export default Root;
