import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "https://t2.mobidic.shop";

const authClient = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

export const authApi = {
  signup: async ({ username, password }) => {
    const { data } = await authClient.post("/api/auth/signup", {
      username,
      password,
    });
    return data;
  },

  login: async ({ username, password }) => {
    const { data } = await authClient.post("/api/auth/login", {
      username,
      password,
    });
    return data; // { accessToken }
  },
};
