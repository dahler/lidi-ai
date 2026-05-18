import { useEffect, useState } from 'react'
import { adminApi, Chatbot } from '../api/admin'

export default function Chatbots() {
  const [chatbots, setChatbots] = useState<Chatbot[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    adminApi.listChatbots()
      .then(setChatbots)
      .finally(() => setLoading(false))
  }, [])

  const handleToggle = async (bot: Chatbot) => {
    const updated = await adminApi.toggleChatbot(bot.id, !bot.is_active)
    setChatbots(prev => prev.map(b => (b.id === bot.id ? updated : b)))
  }

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Permanently delete chatbot "${name}"?`)) return
    await adminApi.deleteChatbot(id)
    setChatbots(prev => prev.filter(b => b.id !== id))
  }

  const filtered = chatbots.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Chatbots</h1>
          <p className="text-gray-500 text-sm mt-1">
            {chatbots.filter(b => b.is_active).length} active / {chatbots.length} total
          </p>
        </div>
        <input
          type="text"
          placeholder="Search chatbots…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-4 py-2 bg-gray-800 border border-gray-700 text-gray-200 rounded-lg
                     text-sm focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-600 w-52"
        />
      </div>

      {loading && <p className="text-gray-500">Loading…</p>}

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-5 py-3 text-gray-400 font-medium">Name</th>
              <th className="text-left px-5 py-3 text-gray-400 font-medium">Org ID</th>
              <th className="text-left px-5 py-3 text-gray-400 font-medium">Status</th>
              <th className="text-left px-5 py-3 text-gray-400 font-medium">Created</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map(bot => (
              <tr key={bot.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-5 py-3">
                  <p className="text-white font-medium">{bot.name}</p>
                  <p className="text-gray-600 text-xs">#{bot.id}</p>
                </td>
                <td className="px-5 py-3 text-gray-400">{bot.organization_id}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    bot.is_active
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-gray-700 text-gray-500'
                  }`}>
                    {bot.is_active ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td className="px-5 py-3 text-gray-500">
                  {new Date(bot.created_at).toLocaleDateString()}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleToggle(bot)}
                      className={`text-xs px-3 py-1 rounded-lg transition-colors font-medium ${
                        bot.is_active
                          ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
                          : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                      }`}
                    >
                      {bot.is_active ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => handleDelete(bot.id, bot.name)}
                      className="text-red-500 hover:text-red-400 text-xs px-2 py-1 rounded
                                 hover:bg-red-500/10 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-gray-600">
                  No chatbots found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
