import React, { useContext, useState } from "react";
import { AuthContext } from "./AuthProvider";
import { Shield, MessageCircle, Eye, EyeOff } from "lucide-react";
import { Link } from "react-router-dom";

const API_BASE_URL = "http://localhost:8000/api";

const Login = () => {
  const { login } = useContext(AuthContext);
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [show2FA, setShow2FA] = useState(false);
  const [tempToken, setTempToken] = useState("");
  const [twoFACode, setTwoFACode] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await login(formData.email, formData.password);
      if (result.requires2fa) {
        setShow2FA(true);
        setTempToken(result.tempToken);
      }
    } catch (error) {
      console.log(error);
      // Handle different error formats
      if (error && typeof error === "object") {
        if (error.error) {
          setError(error.error);
        } else {
          // Check for field errors
          const field = Object.keys(error)[0];
          if (Array.isArray(error[field])) {
            setError(error[field][0]);
          } else {
            setError(error.message || String(error));
          }
        }
      } else {
        setError(error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handle2FASubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/2fa/verify/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ temp_token: tempToken, code: twoFACode }),
      });

      const data = await response.json();
      if (response.ok) {
        localStorage.setItem("access_token", data.access_token);
        localStorage.setItem("refresh_token", data.refresh_token);
        window.location.reload();
      } else {
        setError(data.message || "2FA verification failed");
      }
    } catch (error) {
      setError("2FA verification failed");
    } finally {
      setLoading(false);
    }
  };

  if (show2FA) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-6">
            <Shield className="h-12 w-12 text-blue-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800">
              Two-Factor Authentication
            </h2>
            <p className="text-gray-600 mt-2">
              Enter the 6-digit code from your authenticator app
            </p>
          </div>

          <form onSubmit={handle2FASubmit} className="space-y-4">
            <input
              type="text"
              placeholder="Enter 6-digit code"
              value={twoFACode}
              onChange={(e) => setTwoFACode(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg text-center text-2xl tracking-widest"
              maxLength="6"
              required
            />

            {error && (
              <div className="text-red-500 text-sm text-center">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading || twoFACode.length !== 6}
              className="w-full bg-blue-500 text-white p-3 rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Verify"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <MessageCircle className="h-12 w-12 text-blue-500 mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-gray-800">Welcome Back</h2>
          <p className="text-gray-600 mt-2">Login to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-red-500 text-sm text-center">
              {typeof error === "string" ? error : error.message}
            </div>
          )}
          <div>
            <input
              type="email"
              placeholder="Email address"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 text-white p-3 rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
        <div className="mt-6 flex flex-col items-center space-y-2">
          <Link
            to="/register"
            className="text-blue-500 hover:underline text-sm"
          >
            Don't have an account? Register
          </Link>
          <Link
            to="/password-reset"
            className="text-blue-500 hover:underline text-sm"
          >
            Forgot password?
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
