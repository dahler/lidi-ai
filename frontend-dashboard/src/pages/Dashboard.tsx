import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { chatbotsApi, Chatbot } from '../api/chatbots'

export default function Dashboard() {
  const [chatbots, setChatbots] = useState<Chatbot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    chatbotsApi.list()
      .then(setChatbots)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this chatbot?')) return
    await chatbotsApi.delete(id)
    setChatbots(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Chatbots</h1>
          <p className="text-gray-500 mt-1">Manage your AI chatbots</p>
        </div>
        <Link
          to="/dashboard/create"
          className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-medium
                     hover:bg-indigo-700 transition-colors"
        >
          + New Chatbot
        </Link>
      </div>

      {loading && (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      )}
      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>
      )}

      {!loading && chatbots.length === 0 && (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
          <div className="text-5xl mb-4">🤖</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No chatbots yet</h3>
          <p className="text-gray-400 mb-6">Create your first chatbot and embed it anywhere.</p>
          <Link
            to="/dashboard/create"
            className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700"
          >
            Create Chatbot
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {chatbots.map(bot => (
          <div key={bot.id} className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg"
                style={{ backgroundColor: bot.theme_color }}
              >
                🤖
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                bot.is_active
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-500'
              }`}>
                {bot.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>

            <h3 className="font-semibold text-gray-900 mb-1">{bot.name}</h3>
            <p className="text-sm text-gray-500 mb-4 line-clamp-2">
              {bot.welcome_message}
            </p>

            <div className="flex gap-2">
              <Link
                to={`/dashboard/chatbot/${bot.id}`}
                className="flex-1 text-center text-sm py-2 border border-gray-200 rounded-lg
                           hover:bg-gray-50 transition-colors text-gray-700"
              >
                Settings
              </Link>
              <Link
                to={`/dashboard/chatbot/${bot.id}/conversations`}
                className="flex-1 text-center text-sm py-2 border border-gray-200 rounded-lg
                           hover:bg-gray-50 transition-colors text-gray-700"
              >
                Chats
              </Link>
              <Link
                to={`/dashboard/chatbot/${bot.id}/embed`}
                className="flex-1 text-center text-sm py-2 bg-indigo-50 text-indigo-700 rounded-lg
                           hover:bg-indigo-100 transition-colors font-medium"
              >
                Embed
              </Link>
              <button
                onClick={() => handleDelete(bot.id)}
                className="px-3 py-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete"
              >
                🗑
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
