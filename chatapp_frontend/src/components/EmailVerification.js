import React, { useState, useEffect } from "react";
import ApiService from "../services/ApiService";
import { useLocation } from "react-router-dom";
import { Link } from "react-router-dom";

const EmailVerification = ({ token }) => {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const location = useLocation();

  // Extract token from query string if present
  let queryToken = token;
  if (!queryToken) {
    const params = new URLSearchParams(location.search);
    queryToken = params.get("token");
  }

  const verifyEmail = async () => {
    if (!queryToken) {
      setError("Invalid verification link. No token found.");
      setLoading(false);
      return;
    }

    try {
      const response = await ApiService.post("/auth/email/verify/", {
        token: queryToken,
      });
      if (response.message) {
        setMessage(response.message);
      } else {
        setMessage("Email verified successfully!");
      }
    } catch (err) {
      setError("Verification failed. The link may be invalid or expired.");
    } finally {
      setLoading(false);
    }
  };

  // Automatically verify email when component mounts
  useEffect(() => {
    verifyEmail();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
        {loading ? (
          // Loading state - automatic verification in progress
          <>
            <div className="flex justify-center mb-6">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Verifying Your Email
            </h2>
            <p className="text-gray-600 mb-4">
              Please wait while we verify your email address...
            </p>
          </>
        ) : (
          // Result state - show success or error
          <>
            <div className="flex justify-center mb-6">
              {message ? (
                // Success icon
                <div className="rounded-full h-12 w-12 bg-green-100 flex items-center justify-center">
                  <svg
                    className="h-6 w-6 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              ) : (
                // Error icon
                <div className="rounded-full h-12 w-12 bg-red-100 flex items-center justify-center">
                  <svg
                    className="h-6 w-6 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </div>
              )}
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              {message ? "Email Verified!" : "Verification Failed"}
            </h2>
            {error && (
              <div className="text-red-600 text-sm mb-4 p-3 bg-red-50 rounded-lg">
                {error}
              </div>
            )}
            {message && (
              <div className="text-green-600 text-sm mb-4 p-3 bg-green-50 rounded-lg">
                {message}
              </div>
            )}
            {message ? (
              <div className="mt-6 flex flex-col items-center space-y-2">
                <Link
                  to="/login"
                  className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Continue to Login
                </Link>
                <Link
                  to="/register"
                  className="text-blue-500 hover:underline text-sm"
                >
                  Back to Registration
                </Link>
              </div>
            ) : (
              <div>
                <Link
                  to="/resend-verification"
                  className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Resend Verification Email
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default EmailVerification;
