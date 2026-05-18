import { api } from './client'
import { User } from '../store/auth'

export interface AuthResponse {
  user: User
  access_token: string
  refresh_token: string
}

export const authApi = {
  register: (email: string, password: string, name?: string) =>
    api.post<{ message: string }>('/auth/register', { email, password, name }),

  verifyEmail: (email: string, otp: string) =>
    api.post<AuthResponse>('/auth/verify-email', { email, otp }),

  resendOtp: (email: string) =>
    api.post<{ message: string }>('/auth/resend-otp', { email }),

  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { email, password }),

  googleLogin: (id_token: string) =>
    api.post<AuthResponse>('/auth/google', { id_token }),

  refresh: (refresh_token: string) =>
    api.post<AuthResponse>('/auth/refresh', { refresh_token }),

  me: () => api.get<User>('/auth/me'),

  forgotPassword: (email: string) =>
    api.post<{ message: string }>('/auth/forgot-password', { email }),

  resetPassword: (token: string, password: string) =>
    api.post<{ message: string }>('/auth/reset-password', { token, password }),
}
