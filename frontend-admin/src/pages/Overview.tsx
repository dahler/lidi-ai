import { useEffect, useState } from 'react'
import { adminApi, Organization, Chatbot } from '../api/admin'

interface Stats {
  orgs: number
  users: number
  chatbots: number
  activeChatbots: number
  totalTokens: number
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

export default function Overview() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    Promise.all([
      adminApi.listOrganizations(),
      adminApi.listUsers(),
      adminApi.listChatbots(),
    ]).then(([orgs, users, chatbots]) => {
      setStats({
        orgs: orgs.length,
        users: users.length,
        chatbots: chatbots.length,
        activeChatbots: chatbots.filter((c: Chatbot) => c.is_active).length,
        totalTokens: (orgs as Organization[]).reduce((s, o) => s + (o.total_tokens ?? 0), 0),
      })
    })
  }, [])

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    green: 'bg-green-500/10 text-green-400 border-green-500/20',
    yellow: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  }

  const cards = [
    { label: 'Organizations', value: stats?.orgs, icon: '🏢', color: 'blue' },
    { label: 'Users', value: stats?.users, icon: '👥', color: 'purple' },
    { label: 'Total Chatbots', value: stats?.chatbots, icon: '🤖', color: 'indigo' },
    { label: 'Active Chatbots', value: stats?.activeChatbots, icon: '✅', color: 'green' },
    {
      label: 'Total Tokens Used',
      value: stats ? formatTokens(stats.totalTokens) : undefined,
      icon: '⚡',
      color: 'yellow',
    },
  ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Overview</h1>
        <p className="text-gray-500 mt-1 text-sm">Platform-wide statistics</p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4 mb-10">
        {cards.map(({ label, value, icon, color }) => (
          <div
            key={label}
            className={`border rounded-2xl p-5 ${colorMap[color]}`}
          >
            <div className="text-2xl mb-3">{icon}</div>
            <p className="text-3xl font-bold text-white mb-1">
              {value ?? '—'}
            </p>
            <p className="text-sm opacity-70">{label}</p>
          </div>
        ))}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-white font-semibold mb-4">Quick Links</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { to: '/admin/organizations', label: 'Manage Organizations', icon: '🏢' },
            { to: '/admin/users', label: 'Manage Users', icon: '👥' },
            { to: '/admin/chatbots', label: 'Manage Chatbots', icon: '🤖' },
            { to: '/admin/conversations', label: 'Inspect Conversations', icon: '💬' },
          ].map(({ to, label, icon }) => (
            <a
              key={to}
              href={to}
              className="flex items-center gap-3 p-4 bg-gray-800 rounded-xl
                         hover:bg-gray-700 transition-colors text-gray-300 text-sm"
            >
              <span className="text-xl">{icon}</span>
              {label}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
