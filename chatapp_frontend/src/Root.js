import React from "react";
import AuthProvider from "./components/AuthProvider";
import App from "./App";

const Root = () => (
  <AuthProvider>
    <App />
  </AuthProvider>
);

export default Root;
