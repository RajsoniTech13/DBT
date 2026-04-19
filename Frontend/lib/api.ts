import Cookies from 'js-cookie';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5050/api';

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, data: any, message?: string) {
    super(message || data?.error || 'An unexpected error occurred');
    this.status = status;
    this.data = data;
  }
}

async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const token = Cookies.get('token');
  
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers
  });

  let data;
  try {
    data = await response.json();
  } catch (e) {
    data = null;
  }

  if (!response.ok) {
    // Optionally trigger a global redirect if token is expired
    if (response.status === 401) {
      Cookies.remove('token');
      Cookies.remove('user');
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
         window.location.href = '/login';
      }
    }
    throw new ApiError(response.status, data);
  }

  return data;
}

export const api = {
  get: (endpoint: string, options?: RequestInit) => 
    fetchWithAuth(endpoint, { ...options, method: 'GET' }),
    
  post: (endpoint: string, body: any, options?: RequestInit) => 
    fetchWithAuth(endpoint, { ...options, method: 'POST', body: JSON.stringify(body) }),
    
  patch: (endpoint: string, body: any, options?: RequestInit) => 
    fetchWithAuth(endpoint, { ...options, method: 'PATCH', body: JSON.stringify(body) }),
    
  delete: (endpoint: string, options?: RequestInit) => 
    fetchWithAuth(endpoint, { ...options, method: 'DELETE' }),
};
