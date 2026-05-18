import { useEffect, useState, Fragment } from 'react'
import { adminApi, Organization, OrgStats } from '../api/admin'

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

export default function Organizations() {
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [orgStats, setOrgStats] = useState<Record<number, OrgStats>>({})
  const [loadingStats, setLoadingStats] = useState<number | null>(null)
  const [bulkLoading, setBulkLoading] = useState<number | null>(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    adminApi.listOrganizations()
      .then(setOrgs)
      .finally(() => setLoading(false))
  }, [])

  const toggleExpand = async (orgId: number) => {
    if (expanded === orgId) { setExpanded(null); return }
    setExpanded(orgId)
    if (orgStats[orgId]) return
    setLoadingStats(orgId)
    try {
      const stats = await adminApi.getOrgStats(orgId)
      setOrgStats(prev => ({ ...prev, [orgId]: stats }))
    } finally {
      setLoadingStats(null)
    }
  }

  const handleBulkSet = async (orgId: number, enable: boolean) => {
    setBulkLoading(orgId)
    try {
      const res = await adminApi.bulkSetChatbots(orgId, enable)
      setMsg(`${res.updated} chatbot${res.updated !== 1 ? 's' : ''} ${enable ? 'enabled' : 'disabled'}.`)
      setOrgs(prev => prev.map(o =>
        o.id === orgId ? { ...o, active_chatbots: enable ? o.chatbots : 0 } : o
      ))
      setTimeout(() => setMsg(''), 3000)
    } finally {
      setBulkLoading(null)
    }
  }

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete organization "${name}" and all its data?`)) return
    await adminApi.deleteOrganization(id)
    setOrgs(prev => prev.filter(o => o.id !== id))
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Organizations</h1>
        <p className="text-gray-500 text-sm mt-1">All registered tenants. Click a row to see token breakdown.</p>
      </div>

      {msg && (
        <div className="mb-4 px-4 py-3 bg-green-500/10 text-green-400 border border-green-500/20 rounded-xl text-sm">
          {msg}
        </div>
      )}

      {loading && <p className="text-gray-500">Loading…</p>}

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-5 py-3 text-gray-400 font-medium">Organization</th>
              <th className="text-right px-5 py-3 text-gray-400 font-medium">Chatbots</th>
              <th className="text-right px-5 py-3 text-gray-400 font-medium">Tokens Used</th>
              <th className="text-right px-5 py-3 text-gray-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orgs.map(org => (
              <Fragment key={org.id}>
                <tr
                  className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer"
                  onClick={() => toggleExpand(org.id)}
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600 text-xs w-3">
                        {expanded === org.id ? '▼' : '▶'}
                      </span>
                      <div>
                        <div className="text-white font-medium">{org.name}</div>
                        <div className="text-gray-500 text-xs font-mono">{org.slug}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className={org.active_chatbots > 0 ? 'text-green-400 font-medium' : 'text-gray-600'}>
                      {org.active_chatbots ?? 0}
                    </span>
                    <span className="text-gray-600"> / {org.chatbots ?? 0}</span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="font-mono font-semibold text-yellow-400">
                      {formatTokens(org.total_tokens ?? 0)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleBulkSet(org.id, true)}
                        disabled={bulkLoading === org.id}
                        className="text-xs px-2 py-1 rounded text-green-400 hover:bg-green-500/10 disabled:opacity-40 transition-colors"
                      >
                        Enable all
                      </button>
                      <button
                        onClick={() => handleBulkSet(org.id, false)}
                        disabled={bulkLoading === org.id}
                        className="text-xs px-2 py-1 rounded text-orange-400 hover:bg-orange-500/10 disabled:opacity-40 transition-colors"
                      >
                        Disable all
                      </button>
                      <button
                        onClick={() => handleDelete(org.id, org.name)}
                        className="text-xs px-2 py-1 rounded text-red-500 hover:bg-red-500/10 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>

                {expanded === org.id && (
                  <tr className="border-b border-gray-800/50">
                    <td colSpan={4} className="px-5 py-4 bg-gray-800/40">
                      {loadingStats === org.id ? (
                        <p className="text-gray-500 text-xs">Loading stats…</p>
                      ) : orgStats[org.id] ? (
                        <div className="grid grid-cols-5 gap-3">
                          {[
                            { label: 'Conversations', value: orgStats[org.id].conversations.toLocaleString(), color: 'text-gray-300' },
                            { label: 'Messages', value: orgStats[org.id].messages.toLocaleString(), color: 'text-gray-300' },
                            { label: 'Input Tokens', value: formatTokens(orgStats[org.id].input_tokens), color: 'text-blue-400' },
                            { label: 'Output Tokens', value: formatTokens(orgStats[org.id].output_tokens), color: 'text-purple-400' },
                            { label: 'Total Tokens', value: formatTokens(orgStats[org.id].total_tokens), color: 'text-yellow-400' },
                          ].map(s => (
                            <div key={s.label} className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-center">
                              <div className={`text-base font-bold ${s.color}`}>{s.value}</div>
                              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}

            {!loading && orgs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-gray-600">
                  No organizations yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
