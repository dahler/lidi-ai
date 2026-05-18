import { useEffect, useState } from 'react'
import { adminApi, User } from '../api/admin'

const ROLES = ['super_admin', 'customer_admin', 'customer_user']

const roleBadge: Record<string, string> = {
  super_admin: 'bg-red-500/20 text-red-400',
  customer_admin: 'bg-indigo-500/20 text-indigo-400',
  customer_user: 'bg-gray-700 text-gray-400',
}

export default function Users() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    adminApi.listUsers()
      .then(setUsers)
      .finally(() => setLoading(false))
  }, [])

  const handleRoleChange = async (id: number, role: string) => {
    const updated = await adminApi.updateUserRole(id, role)
    setUsers(prev => prev.map(u => (u.id === id ? updated : u)))
  }

  const handleDelete = async (id: number, email: string) => {
    if (!confirm(`Delete user "${email}"?`)) return
    await adminApi.deleteUser(id)
    setUsers(prev => prev.filter(u => u.id !== id))
  }

  const filtered = users.filter(
    u =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.name ?? '').toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Users</h1>
          <p className="text-gray-500 text-sm mt-1">{users.length} total</p>
        </div>
        <input
          type="text"
          placeholder="Search users…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-4 py-2 bg-gray-800 border border-gray-700 text-gray-200 rounded-lg
                     text-sm focus:outline-none focus:ring-2 focus:ring-red-500 placeholder-gray-600 w-56"
        />
      </div>

      {loading && <p className="text-gray-500">Loading…</p>}

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-5 py-3 text-gray-400 font-medium">User</th>
              <th className="text-left px-5 py-3 text-gray-400 font-medium">Role</th>
              <th className="text-left px-5 py-3 text-gray-400 font-medium">Org ID</th>
              <th className="text-left px-5 py-3 text-gray-400 font-medium">Joined</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map(user => (
              <tr key={user.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-5 py-3">
                  <p className="text-white font-medium">{user.name ?? '—'}</p>
                  <p className="text-gray-500 text-xs">{user.email}</p>
                </td>
                <td className="px-5 py-3">
                  <select
                    value={user.role}
                    onChange={e => handleRoleChange(user.id, e.target.value)}
                    className={`text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer
                                focus:outline-none focus:ring-1 focus:ring-red-500
                                ${roleBadge[user.role] ?? 'bg-gray-700 text-gray-400'}`}
                  >
                    {ROLES.map(r => (
                      <option key={r} value={r} className="bg-gray-800 text-gray-200">
                        {r.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-5 py-3 text-gray-500">
                  {user.organization_id ?? '—'}
                </td>
                <td className="px-5 py-3 text-gray-500">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={() => handleDelete(user.id, user.email)}
                    className="text-red-500 hover:text-red-400 text-xs px-2 py-1 rounded
                               hover:bg-red-500/10 transition-colors"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-gray-600">
                  No users found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
