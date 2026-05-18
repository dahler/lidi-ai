import { useEffect, useState } from 'react'
import { adminApi, Conversation, ConversationMessage } from '../api/admin'

export default function Conversations() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [filterBotId, setFilterBotId] = useState('')
  const [filterOrigin, setFilterOrigin] = useState('')
  const [expanded, setExpanded] = useState<number | null>(null)
  const [messages, setMessages] = useState<Record<number, ConversationMessage[]>>({})
  const [loadingMsgs, setLoadingMsgs] = useState<number | null>(null)

  const load = (chatbotId?: number) => {
    setLoading(true)
    setExpanded(null)
    adminApi.listConversations(chatbotId)
      .then(setConversations)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleFilter = () => {
    const id = parseInt(filterBotId)
    load(isNaN(id) ? undefined : id)
  }

  const toggleExpand = async (convId: number) => {
    if (expanded === convId) {
      setExpanded(null)
      return
    }
    setExpanded(convId)
    if (messages[convId]) return
    setLoadingMsgs(convId)
    try {
      const msgs = await adminApi.getConversationMessages(convId)
      setMessages(prev => ({ ...prev, [convId]: msgs }))
    } finally {
      setLoadingMsgs(null)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Conversations</h1>
        <p className="text-gray-500 text-sm mt-1">
          Inspect all platform conversations. Click a row to view messages.
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex gap-2 mb-5 flex-wrap">
        <input
          type="number"
          placeholder="Filter by chatbot ID…"
          value={filterBotId}
          onChange={e => setFilterBotId(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleFilter()}
          className="px-4 py-2 bg-gray-800 border border-gray-700 text-gray-200 rounded-lg
                     text-sm focus:outline-none focus:ring-2 focus:ring-red-500
                     placeholder-gray-600 w-48"
        />
        <input
          type="text"
          placeholder="Filter by origin (e.g. example.com)…"
          value={filterOrigin}
          onChange={e => setFilterOrigin(e.target.value)}
          className="px-4 py-2 bg-gray-800 border border-gray-700 text-gray-200 rounded-lg
                     text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500
                     placeholder-gray-600 w-64"
        />
        <button
          onClick={handleFilter}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg text-sm transition-colors"
        >
          Filter
        </button>
        <button
          onClick={() => { setFilterBotId(''); setFilterOrigin(''); load() }}
          className="px-4 py-2 text-gray-500 hover:text-gray-300 text-sm transition-colors"
        >
          Clear
        </button>
      </div>

      {loading && <p className="text-gray-500">Loading…</p>}

      <div className="space-y-2">
        {conversations
          .filter(c =>
            !filterOrigin ||
            (c.origin ?? '').toLowerCase().includes(filterOrigin.toLowerCase())
          )
          .map(conv => (
          <div key={conv.id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            {/* Row */}
            <button
              onClick={() => toggleExpand(conv.id)}
              className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-800/50 transition-colors text-left"
            >
              <span className={`text-gray-500 transition-transform ${expanded === conv.id ? 'rotate-90' : ''}`}>
                ▶
              </span>

              <span className="text-gray-600 font-mono text-xs w-8 flex-shrink-0">
                #{conv.id}
              </span>

              <span className="flex-1 text-white text-sm font-medium truncate">
                {conv.title || 'Untitled'}
              </span>

              <span className="flex items-center gap-2 text-xs flex-shrink-0">
                {conv.origin && (
                  <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 rounded-full font-mono max-w-[180px] truncate">
                    🌐 {conv.origin}
                  </span>
                )}
                {conv.chatbot_id && (
                  <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 rounded-full">
                    Bot #{conv.chatbot_id}
                  </span>
                )}
                {conv.user_id && (
                  <span className="px-2 py-0.5 bg-gray-700 text-gray-400 rounded-full">
                    User #{conv.user_id}
                  </span>
                )}
                <span className="text-gray-600">
                  {new Date(conv.created_at).toLocaleString()}
                </span>
              </span>
            </button>

            {/* Messages panel */}
            {expanded === conv.id && (
              <div className="border-t border-gray-800 px-5 py-4 bg-gray-950">
                {loadingMsgs === conv.id ? (
                  <p className="text-gray-500 text-sm text-center py-4">Loading messages…</p>
                ) : !messages[conv.id] || messages[conv.id].length === 0 ? (
                  <p className="text-gray-600 text-sm text-center py-4">No messages</p>
                ) : (
                  <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                    {messages[conv.id].map(msg => (
                      <div
                        key={msg.id}
                        className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        {msg.role !== 'user' && (
                          <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                            🤖
                          </div>
                        )}

                        <div
                          className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                            msg.role === 'user'
                              ? 'bg-indigo-600 text-white rounded-tr-sm'
                              : msg.role === 'system'
                              ? 'bg-yellow-900/40 text-yellow-300 border border-yellow-800 rounded-tl-sm text-xs font-mono'
                              : 'bg-gray-800 text-gray-200 rounded-tl-sm'
                          }`}
                        >
                          {msg.role === 'system' && (
                            <span className="block text-yellow-500 font-semibold mb-1 text-xs">
                              SYSTEM
                            </span>
                          )}
                          {msg.content}
                          <div className="text-xs opacity-40 mt-1">
                            {new Date(msg.created_at).toLocaleTimeString()}
                          </div>
                        </div>

                        {msg.role === 'user' && (
                          <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
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

        {!loading && conversations.length === 0 && (
          <div className="text-center py-12 text-gray-600">
            No conversations found
          </div>
        )}
      </div>
    </div>
  )
}
