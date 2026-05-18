import { api } from './client'
import { AdminUser } from '../store/auth'

export interface AuthResponse {
  user: AdminUser
  access_token: string
  refresh_token: string
}

export interface Organization {
  id: number
  name: string
  slug: string
  created_at: string
  chatbots: number
  active_chatbots: number
  total_tokens: number
}

export interface OrgStats {
  org_id: number
  chatbots: number
  conversations: number
  messages: number
  input_tokens: number
  output_tokens: number
  total_tokens: number
}

export interface User {
  id: number
  email: string
  name: string | null
  role: string
  organization_id: number | null
  is_admin: boolean
  created_at: string
}

export interface Chatbot {
  id: number
  organization_id: number
  name: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Conversation {
  id: number
  title: string
  user_id: number | null
  chatbot_id: number | null
  origin: string | null
  created_at: string
  updated_at: string
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { email, password }),
  googleLogin: (id_token: string) =>
    api.post<AuthResponse>('/auth/google', { id_token }),
  me: () => api.get<AdminUser>('/auth/me'),
}

export const adminApi = {
  // Organizations
  listOrganizations: () =>
    api.get<Organization[]>('/admin/organizations'),
  getOrgStats: (id: number) =>
    api.get<OrgStats>(`/admin/organizations/${id}/stats`),
  bulkSetChatbots: (id: number, is_active: boolean) =>
    api.patch<{ updated: number; is_active: boolean }>(
      `/admin/organizations/${id}/chatbots`,
      { is_active },
    ),
  deleteOrganization: (id: number) =>
    api.delete<void>(`/admin/organizations/${id}`),

  // Users
  listUsers: () =>
    api.get<User[]>('/admin/users'),
  updateUserRole: (id: number, role: string) =>
    api.patch<User>(`/admin/users/${id}`, { role }),
  deleteUser: (id: number) =>
    api.delete<void>(`/admin/users/${id}`),

  // Chatbots
  listChatbots: () =>
    api.get<Chatbot[]>('/admin/chatbots'),
  toggleChatbot: (id: number, is_active: boolean) =>
    api.patch<Chatbot>(`/admin/chatbots/${id}`, { is_active }),
  deleteChatbot: (id: number) =>
    api.delete<void>(`/admin/chatbots/${id}`),

  // Conversations
  listConversations: (chatbotId?: number) => {
    const q = chatbotId ? `?chatbot_id=${chatbotId}` : ''
    return api.get<Conversation[]>(`/admin/conversations${q}`)
  },
  getConversationMessages: (convId: number) =>
    api.get<ConversationMessage[]>(`/admin/conversations/${convId}/messages`),

  // Analytics
  analyticsByOrigin: () =>
    api.get<OriginStat[]>('/admin/analytics/origins'),
  analyticsByChatbot: () =>
    api.get<ChatbotStat[]>('/admin/analytics/chatbots'),
}

export interface ConversationMessage {
  id: number
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
}

export interface OriginStat {
  origin: string
  conversations: number
  messages: number
}

export interface ChatbotStat {
  chatbot_id: number
  name: string
  api_key: string
  conversations: number
  messages: number
  input_tokens: number
  output_tokens: number
  total_tokens: number
}
