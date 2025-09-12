import React, { useState } from "react";
import ApiService from "../services/ApiService";
import { Link } from "react-router-dom";

const PasswordResetConfirm = ({ token }) => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }
    try {
      const response = await ApiService.post("/auth/password/reset/confirm/", {
        token,
        password: newPassword,
        confirm_password: confirmPassword,
      });
      if (response.message) {
        setMessage(response.message);
      } else {
        setError("Reset failed");
      }
    } catch (err) {
      setError("Reset failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">
          Set New Password
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New Password"
            required
            className="w-full p-3 border border-gray-300 rounded-lg"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm Password"
            required
            className="w-full p-3 border border-gray-300 rounded-lg"
          />
          {error && <div className="text-red-500 text-sm">{error}</div>}
          {message && <div className="text-green-500 text-sm">{message}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 text-white p-3 rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? "Resetting..." : "Reset Password"}
          </button>
        </form>
        <div className="mt-6 flex flex-col items-center space-y-2">
          <Link to="/login" className="text-blue-500 hover:underline text-sm">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PasswordResetConfirm;
