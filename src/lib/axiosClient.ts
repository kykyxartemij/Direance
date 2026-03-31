import axios from 'axios';
import { ApiError } from '../models/api-error';

const axiosClient = axios.create({
  timeout: 10000,
});

// When the body is FormData let the browser set Content-Type (multipart + boundary).
axiosClient.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    config.headers.delete('Content-Type');
  }
  return config;
});

// Normalize errors into ApiError
axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error)) {
      throw ApiError.fromAxios(error);
    }
    throw error;
  }
);

export default axiosClient;
