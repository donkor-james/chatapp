import React, { useState } from "react";
import ApiService from "../services/ApiService";
import { Link } from "react-router-dom";

const Register = () => {
  const [formData, setFormData] = useState({
    email: "",
    username: "",
    first_name: "",
    last_name: "",
    password: "",
    confirm_password: "",
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({
    email: null,
    username: null,
    first_name: null,
    last_name: null,
    password: null,
    confirm_password: null,
    general: null,
  });
  const [success, setSuccess] = useState("");

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccess("");
    setErrors({
      email: null,
      username: null,
      first_name: null,
      last_name: null,
      password: null,
      confirm_password: null,
      general: null,
    });
    try {
      const response = await ApiService.post("/auth/register/", formData);
      // Success message
      if (response.message) {
        setSuccess(response.message);
        return;
      }
      // Field errors
      let hasFieldError = false;
      const newErrors = {
        email: null,
        username: null,
        first_name: null,
        last_name: null,
        password: null,
        confirm_password: null,
        general: null,
      };
      [
        "email",
        "username",
        "first_name",
        "last_name",
        "password",
        "confirm_password",
      ].forEach((field) => {
        if (response[field]) {
          newErrors[field] = response[field];
          hasFieldError = true;
        }
      });
      if (hasFieldError) {
        setErrors(newErrors);
      } else if (response.error) {
        setErrors({ ...newErrors, general: response.error });
      } else {
        setErrors({ ...newErrors, general: "Registration failed" });
      }
    } catch (err) {
      let hasFieldError = false;
      const newErrors = {
        email: null,
        username: null,
        first_name: null,
        last_name: null,
        password: null,
        confirm_password: null,
        general: null,
      };
      if (err && typeof err === "object") {
        [
          "email",
          "username",
          "first_name",
          "last_name",
          "password",
          "confirm_password",
        ].forEach((field) => {
          if (err[field]) {
            newErrors[field] = err[field];
            hasFieldError = true;
          }
        });
        if (hasFieldError) {
          setErrors(newErrors);
        } else if (err.error) {
          setErrors({ ...newErrors, general: err.error });
        } else {
          setErrors({ ...newErrors, general: "Registration failed" });
        }
      } else {
        setErrors({ ...newErrors, general: "Registration failed" });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
          Create Account
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            required
            className={`w-full p-3 border rounded-lg ${
              errors.email ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.email && (
            <div className="text-red-500 text-xs text-left mt-1">
              {errors.email[0]}
            </div>
          )}
          <input
            type="text"
            name="username"
            placeholder="Username"
            value={formData.username}
            onChange={handleChange}
            required
            className={`w-full p-3 border rounded-lg ${
              errors.username ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.username && (
            <div className="text-red-500 text-xs text-left mt-1">
              {errors.username[0]}
            </div>
          )}
          <input
            type="text"
            name="first_name"
            placeholder="First Name"
            value={formData.first_name}
            onChange={handleChange}
            required
            className={`w-full p-3 border rounded-lg ${
              errors.first_name ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.first_name && (
            <div className="text-red-500 text-xs text-left mt-1">
              {errors.first_name[0]}
            </div>
          )}
          <input
            type="text"
            name="last_name"
            placeholder="Last Name"
            value={formData.last_name}
            onChange={handleChange}
            required
            className={`w-full p-3 border rounded-lg ${
              errors.last_name ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.last_name && (
            <div className="text-red-500 text-xs text-left mt-1">
              {errors.last_name[0]}
            </div>
          )}
          <input
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            required
            className={`w-full p-3 border rounded-lg ${
              errors.password ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.password && (
            <div className="text-red-500 text-xs text-left mt-1">
              {errors.password[0]}
            </div>
          )}
          <input
            type="password"
            name="confirm_password"
            placeholder="Confirm Password"
            value={formData.confirm_password}
            onChange={handleChange}
            required
            className={`w-full p-3 border rounded-lg ${
              errors.confirm_password ? "border-red-500" : "border-gray-300"
            }`}
          />
          {errors.confirm_password && (
            <div className="text-red-500 text-xs text-left mt-1">
              {errors.confirm_password[0]}
            </div>
          )}
          {errors.general && (
            <div className="text-red-500 text-sm text-center">
              {errors.general}
            </div>
          )}
          {success && (
            <div className="text-green-500 text-sm text-center">{success}</div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 text-white p-3 rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? "Registering..." : "Register"}
          </button>
        </form>
        <div className="mt-6 flex flex-col items-center space-y-2">
          <Link to="/login" className="text-blue-500 hover:underline text-sm">
            Already have an account? Sign in
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
