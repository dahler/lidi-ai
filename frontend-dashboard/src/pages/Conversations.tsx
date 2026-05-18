import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { chatbotsApi, Chatbot, ChatbotConversation, ChatbotMessage } from '../api/chatbots'

export default function Conversations() {
  const { id } = useParams<{ id: string }>()
  const chatbotId = Number(id)

  const [chatbot, setChatbot] = useState<Chatbot | null>(null)
  const [conversations, setConversations] = useState<ChatbotConversation[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [messages, setMessages] = useState<Record<number, ChatbotMessage[]>>({})
  const [loadingMsgs, setLoadingMsgs] = useState<number | null>(null)

  useEffect(() => {
    chatbotsApi.get(chatbotId).then(setChatbot)
    chatbotsApi.listConversations(chatbotId)
      .then(setConversations)
      .finally(() => setLoading(false))
  }, [chatbotId])

  const toggleExpand = async (convId: number) => {
    if (expanded === convId) { setExpanded(null); return }
    setExpanded(convId)
    if (messages[convId]) return
    setLoadingMsgs(convId)
    try {
      const msgs = await chatbotsApi.getMessages(chatbotId, convId)
      setMessages(prev => ({ ...prev, [convId]: msgs }))
    } finally {
      setLoadingMsgs(null)
    }
  }

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/dashboard/chatbot/${chatbotId}`} className="text-gray-400 hover:text-gray-600 text-lg">←</Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {chatbot?.name ?? '…'} — Conversations
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {loading && <p className="text-gray-400 text-sm">Loading…</p>}

      {!loading && conversations.length === 0 && (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
          <div className="text-5xl mb-4">💬</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No conversations yet</h3>
          <p className="text-gray-400 text-sm">
            Conversations will appear here once users start chatting.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {conversations.map(conv => (
          <div key={conv.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {/* Row */}
            <button
              onClick={() => toggleExpand(conv.id)}
              className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
            >
              <span className={`text-gray-400 text-xs transition-transform ${expanded === conv.id ? 'rotate-90' : ''}`}>
                ▶
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {conv.title || 'Untitled conversation'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Started {new Date(conv.created_at).toLocaleString()} ·
                  Last active {new Date(conv.updated_at).toLocaleString()}
                  {conv.origin && (
                    <> · <span className="text-indigo-400">{conv.origin}</span></>
                  )}
                </p>
              </div>
              <span className="text-xs text-gray-400 font-mono flex-shrink-0">#{conv.id}</span>
            </button>

            {/* Messages */}
            {expanded === conv.id && (
              <div className="border-t border-gray-100 px-5 py-4 bg-gray-50">
                {loadingMsgs === conv.id ? (
                  <p className="text-center text-gray-400 text-sm py-4">Loading messages…</p>
                ) : !messages[conv.id]?.length ? (
                  <p className="text-center text-gray-400 text-sm py-4">No messages</p>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {messages[conv.id]
                      .filter(m => m.role !== 'system')
                      .map(msg => (
                        <div
                          key={msg.id}
                          className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          {msg.role === 'assistant' && (
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0 mt-0.5"
                              style={{ backgroundColor: chatbot?.theme_color ?? '#6366f1' }}
                            >
                              🤖
                            </div>
                          )}
                          <div
                            className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                              msg.role === 'user'
                                ? 'text-white rounded-tr-sm'
                                : 'bg-white text-gray-800 border border-gray-200 rounded-tl-sm'
                            }`}
                            style={
                              msg.role === 'user'
                                ? { backgroundColor: chatbot?.theme_color ?? '#6366f1' }
                                : {}
                            }
                          >
                            {msg.content}
                            <div className="text-xs opacity-50 mt-1">
                              {new Date(msg.created_at).toLocaleTimeString()}
                            </div>
                          </div>
                          {msg.role === 'user' && (
                            <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                              👤
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
