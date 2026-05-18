import { useEffect, useState } from 'react'
import { adminApi, OriginStat, ChatbotStat } from '../api/admin'

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
      <div className="h-full bg-red-500 rounded-full" style={{ width: `${pct}%` }} />
    </div>
  )
}

export default function Analytics() {
  const [origins, setOrigins] = useState<OriginStat[]>([])
  const [chatbots, setChatbots] = useState<ChatbotStat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      adminApi.analyticsByOrigin(),
      adminApi.analyticsByChatbot(),
    ]).then(([o, c]) => {
      setOrigins(o)
      setChatbots(c)
    }).finally(() => setLoading(false))
  }, [])

  const maxOriginConvs = Math.max(...origins.map(o => o.conversations), 1)
  const maxBotConvs = Math.max(...chatbots.map(b => b.conversations), 1)

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Usage Analytics</h1>
        <p className="text-gray-500 text-sm mt-1">
          Which websites and chatbots are driving the most activity.
        </p>
      </div>

      {loading && <p className="text-gray-500">Loading…</p>}

      {/* Origins table */}
      <div>
        <h2 className="text-white font-semibold mb-3">
          Traffic by Website Origin
        </h2>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-5 py-3 text-gray-400 font-medium">Website</th>
                <th className="text-right px-5 py-3 text-gray-400 font-medium">Conversations</th>
                <th className="text-right px-5 py-3 text-gray-400 font-medium">Messages</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {origins.map((row, i) => (
                <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      {row.origin === '(unknown)' ? (
                        <span className="text-gray-600 font-mono text-xs">— unknown —</span>
                      ) : (
                        <>
                          <span className="text-emerald-400">🌐</span>
                          <span className="text-white font-mono text-xs">{row.origin}</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right text-white font-semibold">
                    {row.conversations.toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-right text-gray-400">
                    {row.messages.toLocaleString()}
                  </td>
                  <td className="px-5 py-3 flex justify-end items-center">
                    <Bar value={row.conversations} max={maxOriginConvs} />
                  </td>
                </tr>
              ))}
              {!loading && origins.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-gray-600">
                    No conversation data yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chatbots / API keys table */}
      <div>
        <h2 className="text-white font-semibold mb-3">
          Usage by Chatbot (API Key)
        </h2>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-5 py-3 text-gray-400 font-medium">Chatbot</th>
                <th className="text-left px-5 py-3 text-gray-400 font-medium">API Key</th>
                <th className="text-right px-5 py-3 text-gray-400 font-medium">Conversations</th>
                <th className="text-right px-5 py-3 text-gray-400 font-medium">Messages</th>
                <th className="text-right px-5 py-3 text-gray-400 font-medium">Tokens</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {chatbots.map(bot => (
                <tr key={bot.chatbot_id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-5 py-3">
                    <p className="text-white font-medium">{bot.name}</p>
                    <p className="text-gray-600 text-xs">#{bot.chatbot_id}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span className="font-mono text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded">
                      {bot.api_key}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right text-white font-semibold">
                    {bot.conversations.toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-right text-gray-400">
                    {bot.messages.toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="text-yellow-400 font-mono font-semibold">
                      {formatTokens(bot.total_tokens)}
                    </span>
                    <div className="text-xs text-gray-600 mt-0.5">
                      {formatTokens(bot.input_tokens)} in · {formatTokens(bot.output_tokens)} out
                    </div>
                  </td>
                  <td className="px-5 py-3 flex justify-end items-center">
                    <Bar value={bot.conversations} max={maxBotConvs} />
                  </td>
                </tr>
              ))}
              {!loading && chatbots.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-gray-600">
                    No chatbots found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
