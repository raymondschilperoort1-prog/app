import axios from "axios";

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("ch_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const wsUrl = (conversationId, token) => {
  const base = BACKEND_URL.replace(/^http/, "ws");
  return `${base}/api/ws/${conversationId}?token=${encodeURIComponent(token)}`;
};
