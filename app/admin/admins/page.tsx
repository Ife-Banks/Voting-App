'use client'

import { useState, useEffect } from 'react'
import { AdminProfile } from '@/lib/types'

export default function AdminsPage() {
  const [admins, setAdmins] = useState<AdminProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviting, setInviting] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')
  const [deleting, setDeleting] = useState<string | null>(null)

  async function loadAdmins() {
    const res = await fetch('/api/admin/list')
    if (res.ok) {
      const data = await res.json()
      setAdmins(data.admins)
    }
    setLoading(false)
  }

  useEffect(() => { loadAdmins() }, [])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviting(true)
    setMessage('')

    const res = await fetch('/api/admin/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, name: inviteName }),
    })

    const data = await res.json()
    setInviting(false)

    if (data.success) {
      setMessageType('success')
      setMessage(
        `Invited! ${data.emailSent ? 'Email sent.' : 'Share the link manually:'}\n${data.setupLink}`
      )
      setInviteEmail('')
      setInviteName('')
      setShowInvite(false)
      loadAdmins()
    } else {
      setMessageType('error')
      setMessage(data.error || 'Failed to invite')
    }
  }

  async function handleDelete(adminId: string) {
    if (!confirm('Remove this admin? They will lose access immediately.')) return
    setDeleting(adminId)

    const res = await fetch('/api/admin/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId }),
    })

    setDeleting(null)

    if (res.ok) {
      loadAdmins()
    } else {
      const data = await res.json()
      setMessageType('error')
      setMessage(data.error || 'Failed to delete')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Admin Management</h1>
        <button
          onClick={() => setShowInvite(!showInvite)}
          className="px-4 py-2 bg-[#C9A84C] text-[#0A0A0F] rounded-lg font-semibold hover:bg-[#B8943F] transition-colors text-sm cursor-pointer whitespace-nowrap"
        >
          {showInvite ? 'Cancel' : 'Invite Admin'}
        </button>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-xl text-sm ${
          messageType === 'success' ? 'bg-green-900/30 text-green-300 border border-green-800/50' :
          'bg-red-900/30 text-red-300 border border-red-800/50'
        } whitespace-pre-wrap`}>
          {message}
        </div>
      )}

      {showInvite && (
        <div className="mb-8 bg-[#13131A] border border-[#20203A] rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Invite New Admin</h2>
          <form onSubmit={handleInvite} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Name</label>
              <input
                type="text"
                value={inviteName}
                onChange={e => setInviteName(e.target.value)}
                placeholder="Admin's full name"
                className="w-full px-4 py-3 bg-[#1A1A24] border border-[#20203A] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A84C]"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Email</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-full px-4 py-3 bg-[#1A1A24] border border-[#20203A] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-[#C9A84C]"
                required
              />
            </div>
            <button
              type="submit"
              disabled={inviting}
              className="px-6 py-3 bg-[#C9A84C] text-[#0A0A0F] rounded-xl font-semibold hover:bg-[#B8943F] transition-colors disabled:opacity-50 cursor-pointer"
            >
              {inviting ? 'Sending Invite...' : 'Send Invitation'}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-[#C9A84C] border-t-transparent rounded-full mx-auto"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {admins.map(admin => (
            <div
              key={admin.id}
              className="bg-[#13131A] border border-[#20203A] rounded-xl p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold">{admin.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    admin.role === 'super_admin'
                      ? 'bg-yellow-900/30 text-yellow-300 border border-yellow-800/50'
                      : 'bg-blue-900/30 text-blue-300 border border-blue-800/50'
                  }`}>
                    {admin.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                  </span>
                </div>
                <p className="text-gray-400 text-sm mt-1">{admin.email}</p>
                {admin.role === 'admin' && (
                  <div className="flex gap-3 mt-2 text-xs text-gray-500">
                    <span className={admin.permissions.view_results ? 'text-green-400' : 'text-gray-600'}>
                      &#10003; Results
                    </span>
                    <span className={admin.permissions.view_positions ? 'text-green-400' : 'text-gray-600'}>
                      &#10003; Positions
                    </span>
                  </div>
                )}
              </div>
              <div className="text-xs text-gray-500">
                {admin.created_at && (
                  <p>Added {new Date(admin.created_at).toLocaleDateString()}</p>
                )}
                {admin.role !== 'super_admin' && (
                  <button
                    onClick={() => handleDelete(admin.id)}
                    disabled={deleting === admin.id}
                    className="mt-2 text-red-400 hover:text-red-300 transition-colors text-sm cursor-pointer disabled:opacity-50"
                  >
                    {deleting === admin.id ? 'Removing...' : 'Remove'}
                  </button>
                )}
              </div>
            </div>
          ))}
          {admins.length === 0 && (
            <p className="text-gray-500 text-center py-8">No admins found.</p>
          )}
        </div>
      )}
    </div>
  )
}
