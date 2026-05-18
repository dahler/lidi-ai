import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import RequireAuth from './components/RequireAuth'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import CreateChatbot from './pages/CreateChatbot'
import ChatbotSettings from './pages/ChatbotSettings'
import EmbedCode from './pages/EmbedCode'
import Conversations from './pages/Conversations'
import AdminDashboard from './pages/AdminDashboard'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Protected routes */}
        <Route element={<RequireAuth />}>
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboard/create" element={<CreateChatbot />} />
            <Route path="/dashboard/chatbot/:id" element={<ChatbotSettings />} />
            <Route path="/dashboard/chatbot/:id/embed" element={<EmbedCode />} />
            <Route path="/dashboard/chatbot/:id/conversations" element={<Conversations />} />
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>
        </Route>

        {/* Default redirect */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
