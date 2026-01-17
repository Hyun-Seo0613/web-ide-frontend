import axios from "axios";
import { getAccessToken, logout } from "../auth/auth";

const baseURL = import.meta.env.VITE_API_BASE_URL || "https://t2.mobidic.shop";

export const client = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
});

// 요청마다 토큰 자동 첨부
client.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 401 처리(선택)
client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      logout();
      // window.location.href = "/login"; // 원하면 켜
    }
    return Promise.reject(err);
  }
);
