import React, { useState } from "react";
import ApiService from "../services/ApiService";
import { useLocation } from "react-router-dom";
import { Link } from "react-router-dom";

const EmailVerification = ({ token }) => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const location = useLocation();

  // Extract token from query string if present
  let queryToken = token;
  if (!queryToken) {
    const params = new URLSearchParams(location.search);
    queryToken = params.get("token");
  }

  const handleVerify = async () => {
    setLoading(true);
    setMessage("");
    setError("");
    try {
      const response = await ApiService.post("/auth/email/verify/", {
        token: queryToken,
      });
      if (response.message) {
        setMessage(response.message);
      } else {
        setError("Verification failed");
      }
    } catch (err) {
      setError("Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">
          Email Verification
        </h2>
        <p className="mb-4">
          Click the button below to verify your email address.
        </p>
        {error && <div className="text-red-500 text-sm mb-2">{error}</div>}
        {message && (
          <div className="text-green-500 text-sm mb-2">{message}</div>
        )}
        <button
          onClick={handleVerify}
          disabled={loading}
          className="w-full bg-blue-500 text-white p-3 rounded-lg hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? "Verifying..." : "Verify Email"}
        </button>
        <div className="mt-6 flex flex-col items-center space-y-2">
          <Link to="/login" className="text-blue-500 hover:underline text-sm">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default EmailVerification;
