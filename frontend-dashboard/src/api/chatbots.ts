import { api } from './client'

export interface Chatbot {
  id: number
  organization_id: number
  api_key: string
  name: string
  welcome_message: string
  theme_color: string
  system_prompt: string
  is_active: boolean
  guardrails_enabled: boolean
  blocked_keywords: string
  allowed_topics: string
  off_topic_message: string
  created_at: string
  updated_at: string
}

export interface ChatbotCreate {
  name: string
  welcome_message?: string
  theme_color?: string
  system_prompt?: string
}

export interface ChatbotUpdate {
  name?: string
  welcome_message?: string
  theme_color?: string
  system_prompt?: string
  is_active?: boolean
  guardrails_enabled?: boolean
  blocked_keywords?: string
  allowed_topics?: string
  off_topic_message?: string
}

export interface ChatbotDocument {
  id: number
  filename: string
  content_type: string
  file_size: number
  created_at: string
}

export interface ChatbotStats {
  conversations: number
  messages: number
  documents: number
  chunks: number
  input_tokens: number
  output_tokens: number
  total_tokens: number
}

export interface ChatbotConversation {
  id: number
  title: string
  origin: string | null
  created_at: string
  updated_at: string
}

export interface ChatbotMessage {
  id: number
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
}

function getToken(): string | null {
  const raw = localStorage.getItem('lidi-auth')
  if (!raw) return null
  try { return JSON.parse(raw)?.state?.accessToken ?? null } catch { return null }
}

export const chatbotsApi = {
  list: () => api.get<Chatbot[]>('/chatbots'),
  get: (id: number) => api.get<Chatbot>(`/chatbots/${id}`),
  create: (data: ChatbotCreate) => api.post<Chatbot>('/chatbots', data),
  update: (id: number, data: ChatbotUpdate) => api.put<Chatbot>(`/chatbots/${id}`, data),
  delete: (id: number) => api.delete<void>(`/chatbots/${id}`),

  getStats: (id: number) => api.get<ChatbotStats>(`/chatbots/${id}/stats`),

  listDocuments: (id: number) =>
    api.get<ChatbotDocument[]>(`/chatbots/${id}/documents`),

  deleteDocument: (chatbotId: number, docId: number) =>
    api.delete<void>(`/chatbots/${chatbotId}/documents/${docId}`),

  listConversations: (chatbotId: number) =>
    api.get<ChatbotConversation[]>(`/chatbots/${chatbotId}/conversations`),

  getMessages: (chatbotId: number, convId: number) =>
    api.get<ChatbotMessage[]>(
      `/chatbots/${chatbotId}/conversations/${convId}/messages`
    ),

  uploadDocument: (chatbotId: number, file: File): Promise<ChatbotDocument> => {
    const token = getToken()
    const form = new FormData()
    form.append('file', file)
    return fetch(`/api/chatbots/${chatbotId}/documents`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }).then(async r => {
      if (!r.ok) {
        const err = await r.json().catch(() => ({ detail: r.statusText }))
        throw new Error(err.detail ?? 'Upload failed')
      }
      return r.json()
    })
  },
}
