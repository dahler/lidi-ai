import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../store/auth'

export default function RequireAdmin() {
  const { isAuthenticated, isSuperAdmin } = useAuthStore()
  if (!isAuthenticated()) return <Navigate to="/login" replace />
  if (!isSuperAdmin()) return <Navigate to="/login" replace />
  return <Outlet />
}
