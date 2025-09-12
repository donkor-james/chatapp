const API_BASE_URL = "http://localhost:8000/api";
const WS_BASE_URL = "ws://localhost:8000/ws";

class ApiService {
  static getAuthHeaders() {
    const token = localStorage.getItem("access_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  static async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      headers: {
        "Content-Type": "application/json",
        ...this.getAuthHeaders(),
        ...options.headers,
      },
      ...options,
    };

    const response = await fetch(url, config);

    if (response.status === 401) {
      // Try to refresh token
      const refreshToken = localStorage.getItem("refresh_token");
      if (refreshToken) {
        const refreshResponse = await fetch(
          `${API_BASE_URL}/auth/token/refresh/`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh: refreshToken }),
          }
        );

        if (refreshResponse.ok) {
          const data = await refreshResponse.json();
          localStorage.setItem("access_token", data.access);
          // Retry original request
          config.headers.Authorization = `Bearer ${data.access}`;
          return fetch(url, config);
        } else {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          window.location.href = "/login";
        }
      }
    }
    console.log(response);
    return response;
  }

  static async get(endpoint) {
    const response = await this.request(endpoint);
    return response.json();
  }

  static async post(endpoint, data) {
    const response = await this.request(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
    });
    return response.json();
  }
}

export default ApiService;
