import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface AdminUser {
  id: number
  email: string
  name: string | null
  role: 'super_admin' | 'customer_admin' | 'customer_user'
}

interface AuthState {
  user: AdminUser | null
  accessToken: string | null
  refreshToken: string | null
  setAuth: (user: AdminUser, accessToken: string, refreshToken: string) => void
  clearAuth: () => void
  isAuthenticated: () => boolean
  isSuperAdmin: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setAuth: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken }),
      clearAuth: () =>
        set({ user: null, accessToken: null, refreshToken: null }),
      isAuthenticated: () => !!get().accessToken,
      isSuperAdmin: () => get().user?.role === 'super_admin',
    }),
    { name: 'lidi-admin-auth' },
  ),
)
