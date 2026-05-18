import { api } from './client'

export interface OrgRow {
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

export interface AdminChatbot {
  id: number
  organization_id: number
  name: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export const adminApi = {
  listOrgs: () => api.get<OrgRow[]>('/admin/organizations'),
  getOrgStats: (orgId: number) => api.get<OrgStats>(`/admin/organizations/${orgId}/stats`),
  bulkSetChatbots: (orgId: number, isActive: boolean) =>
    api.patch<{ updated: number; is_active: boolean }>(
      `/admin/organizations/${orgId}/chatbots`,
      { is_active: isActive },
    ),
  listChatbots: () => api.get<AdminChatbot[]>('/admin/chatbots'),
  setChatbotActive: (chatbotId: number, isActive: boolean) =>
    api.patch<AdminChatbot>(`/admin/chatbots/${chatbotId}`, { is_active: isActive }),
}
