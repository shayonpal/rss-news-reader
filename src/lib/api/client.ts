import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { useAuthStore } from '@/lib/stores/auth-store';

// Create axios instance
const client: AxiosInstance = axios.create({
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth headers
client.interceptors.request.use(
  async (config) => {
    // Add timestamp to all requests
    config.headers['X-Request-Time'] = Date.now().toString();
    
    // For Inoreader API requests, we don't add auth headers here
    // since tokens are stored in httpOnly cookies
    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling and token refresh
client.interceptors.response.use(
  (response: AxiosResponse) => {
    // Log successful requests in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`✓ ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`);
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 errors (unauthorized)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Attempt to refresh token
        const refreshResponse = await fetch('/api/auth/inoreader/refresh', {
          method: 'POST',
        });

        if (refreshResponse.ok) {
          // Retry the original request
          return client(originalRequest);
        } else {
          // Refresh failed, redirect to login
          useAuthStore.getState().logout();
          return Promise.reject(error);
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        useAuthStore.getState().logout();
        return Promise.reject(error);
      }
    }

    // Handle rate limiting (429)
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'];
      const delay = retryAfter ? parseInt(retryAfter) * 1000 : 5000; // Default 5 seconds
      
      console.warn(`Rate limited. Retrying after ${delay}ms`);
      
      // Wait and retry once
      if (!originalRequest._retryAfterRateLimit) {
        originalRequest._retryAfterRateLimit = true;
        await new Promise(resolve => setTimeout(resolve, delay));
        return client(originalRequest);
      }
    }

    // Log errors in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`✗ ${error.config?.method?.toUpperCase()} ${error.config?.url} - ${error.response?.status || 'NETWORK_ERROR'}`);
      console.error('Error details:', error.response?.data || error.message);
    }

    return Promise.reject(error);
  }
);

// Helper function for making requests with proper error handling
export async function apiRequest<T = any>(
  config: AxiosRequestConfig
): Promise<T> {
  try {
    const response = await client(config);
    return response.data;
  } catch (error) {
    // Transform axios errors to more user-friendly format
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.error || 
                    error.response?.data?.message || 
                    error.message;
      
      throw new Error(message);
    }
    throw error;
  }
}

// Convenience methods
export const api = {
  get: <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> =>
    apiRequest<T>({ ...config, method: 'GET', url }),
  
  post: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> =>
    apiRequest<T>({ ...config, method: 'POST', url, data }),
  
  put: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> =>
    apiRequest<T>({ ...config, method: 'PUT', url, data }),
  
  delete: <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> =>
    apiRequest<T>({ ...config, method: 'DELETE', url }),
  
  patch: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> =>
    apiRequest<T>({ ...config, method: 'PATCH', url, data }),
};

export default client;