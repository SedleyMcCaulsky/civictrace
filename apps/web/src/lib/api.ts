import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://civictrace-production.up.railway.app/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('civictrace_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('civictrace_token');
        localStorage.removeItem('civictrace_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);
