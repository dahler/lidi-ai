import { useEffect, useState } from 'react'
import { Fragment } from 'react'
import { adminApi, OrgRow, OrgStats } from '../api/admin'

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

export default function AdminDashboard() {
  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [selectedOrg, setSelectedOrg] = useState<number | null>(null)
  const [orgStats, setOrgStats] = useState<Record<number, OrgStats>>({})
  const [loadingStats, setLoadingStats] = useState<number | null>(null)
  const [bulkLoading, setBulkLoading] = useState<number | null>(null)
  const [bulkMsg, setBulkMsg] = useState('')

  useEffect(() => {
    adminApi.listOrgs().then(setOrgs)
  }, [])

  const toggleOrg = async (orgId: number) => {
    if (selectedOrg === orgId) {
      setSelectedOrg(null)
      return
    }
    setSelectedOrg(orgId)
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
    setBulkMsg('')
    try {
      const res = await adminApi.bulkSetChatbots(orgId, enable)
      setBulkMsg(
        `${res.updated} chatbot${res.updated !== 1 ? 's' : ''} ${enable ? 'enabled' : 'disabled'}.`
      )
      setOrgs(prev =>
        prev.map(o =>
          o.id === orgId
            ? { ...o, active_chatbots: enable ? o.chatbots : 0 }
            : o
        )
      )
      setTimeout(() => setBulkMsg(''), 3000)
    } finally {
      setBulkLoading(null)
    }
  }

  const totalTokens = orgs.reduce((s, o) => s + o.total_tokens, 0)
  const totalChatbots = orgs.reduce((s, o) => s + o.chatbots, 0)
  const totalActive = orgs.reduce((s, o) => s + o.active_chatbots, 0)

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">
          Platform-wide usage, organizations, and chatbot management.
        </p>
      </div>

      {/* Platform summary */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="text-2xl mb-2">🏢</div>
          <div className="text-2xl font-bold text-gray-900">{orgs.length}</div>
          <div className="text-sm text-gray-500 mt-0.5">Organizations</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="text-2xl mb-2">🤖</div>
          <div className="text-2xl font-bold text-gray-900">
            {totalActive}
            <span className="text-base font-normal text-gray-400"> / {totalChatbots}</span>
          </div>
          <div className="text-sm text-gray-500 mt-0.5">Active Chatbots</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="text-2xl mb-2">⚡</div>
          <div className="text-2xl font-bold text-indigo-600">{formatTokens(totalTokens)}</div>
          <div className="text-sm text-gray-500 mt-0.5">Total Tokens Used</div>
        </div>
      </div>

      {bulkMsg && (
        <div className="mb-4 px-4 py-3 bg-green-50 text-green-700 rounded-xl text-sm">
          {bulkMsg}
        </div>
      )}

      {/* Org table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Organizations</h2>
          <p className="text-xs text-gray-400 mt-0.5">Click a row to see detailed token breakdown.</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-gray-100">
              <th className="px-6 py-3 text-left">Organization</th>
              <th className="px-6 py-3 text-right">Chatbots</th>
              <th className="px-6 py-3 text-right">Total Tokens</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orgs.map(org => (
              <Fragment key={org.id}>
                <tr
                  className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                  onClick={() => toggleOrg(org.id)}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-300 text-xs">
                        {selectedOrg === org.id ? '▼' : '▶'}
                      </span>
                      <div>
                        <div className="font-medium text-gray-900">{org.name}</div>
                        <div className="text-xs text-gray-400">{org.slug}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={org.active_chatbots > 0 ? 'text-green-600 font-medium' : 'text-gray-400'}>
                      {org.active_chatbots}
                    </span>
                    <span className="text-gray-300"> / {org.chatbots}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-mono font-semibold text-indigo-600">
                      {formatTokens(org.total_tokens)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleBulkSet(org.id, true)}
                        disabled={bulkLoading === org.id}
                        className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg disabled:opacity-40 transition-colors"
                      >
                        Enable all
                      </button>
                      <button
                        onClick={() => handleBulkSet(org.id, false)}
                        disabled={bulkLoading === org.id}
                        className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg disabled:opacity-40 transition-colors"
                      >
                        Disable all
                      </button>
                    </div>
                  </td>
                </tr>

                {selectedOrg === org.id && (
                  <tr className="border-b border-gray-100">
                    <td colSpan={4} className="px-6 py-5 bg-indigo-50/60">
                      {loadingStats === org.id ? (
                        <p className="text-sm text-gray-400">Loading…</p>
                      ) : orgStats[org.id] ? (
                        <div className="grid grid-cols-5 gap-3">
                          {[
                            {
                              label: 'Conversations',
                              value: orgStats[org.id].conversations.toLocaleString(),
                              color: 'text-gray-900',
                            },
                            {
                              label: 'Messages',
                              value: orgStats[org.id].messages.toLocaleString(),
                              color: 'text-gray-900',
                            },
                            {
                              label: 'Input Tokens',
                              value: formatTokens(orgStats[org.id].input_tokens),
                              color: 'text-blue-600',
                            },
                            {
                              label: 'Output Tokens',
                              value: formatTokens(orgStats[org.id].output_tokens),
                              color: 'text-purple-600',
                            },
                            {
                              label: 'Total Tokens',
                              value: formatTokens(orgStats[org.id].total_tokens),
                              color: 'text-indigo-700',
                            },
                          ].map(s => (
                            <div key={s.label} className="bg-white rounded-xl p-3 text-center shadow-sm">
                              <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
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
          </tbody>
        </table>

        {orgs.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-2">🏢</div>
            <p className="text-sm">No organizations yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}
