import axios from 'axios';

export const api = axios.create({
  baseURL: 'https://civictrace-production.up.railway.app/api/v1',
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
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);
