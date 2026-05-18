import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import RequireAdmin from './components/RequireAdmin'
import Layout from './components/Layout'
import Login from './pages/Login'
import Overview from './pages/Overview'
import Organizations from './pages/Organizations'
import Users from './pages/Users'
import Chatbots from './pages/Chatbots'
import Conversations from './pages/Conversations'
import Analytics from './pages/Analytics'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<RequireAdmin />}>
          <Route element={<Layout />}>
            <Route path="/admin" element={<Overview />} />
            <Route path="/admin/organizations" element={<Organizations />} />
            <Route path="/admin/users" element={<Users />} />
            <Route path="/admin/chatbots" element={<Chatbots />} />
            <Route path="/admin/conversations" element={<Conversations />} />
            <Route path="/admin/analytics" element={<Analytics />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
