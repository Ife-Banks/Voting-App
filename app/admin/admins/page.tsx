'use client'

import { useState, useEffect } from 'react'
import { AdminProfile } from '@/lib/types'
import { X, Copy, CheckCircle2, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function AdminsPage() {
  const [admins, setAdmins] = useState<AdminProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState<{ link: string; sent: boolean } | null>(null)
  const [copied, setCopied] = useState(false)
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
      setInviteResult({ link: data.setupLink, sent: data.emailSent })
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

  function copyLink() {
    if (!inviteResult) return
    navigator.clipboard.writeText(inviteResult.link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function closeModal() {
    setInviteResult(null)
    setCopied(false)
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
        }`}>
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

      {/* Invite link modal */}
      {inviteResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
          <div className="bg-[#13131A] border border-[#20203A] rounded-2xl p-6 w-full max-w-md relative">
            <button onClick={closeModal}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/5 cursor-pointer"
              style={{ color: 'rgba(245,240,232,0.4)' }}>
              <X size={18} />
            </button>

            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4"
                style={{ background: 'rgba(76,175,80,0.15)', border: '1px solid rgba(76,175,80,0.3)' }}>
                <CheckCircle2 size={28} style={{ color: '#4CAF50' }} />
              </div>
              <h2 className="text-xl font-semibold text-white mb-1">Admin Invited!</h2>
              {inviteResult.sent ? (
                <p className="text-sm" style={{ color: 'rgba(76,175,80,0.7)' }}>
                  An email has been sent to the admin.
                </p>
              ) : (
                <p className="text-sm text-gray-400">
                  Copy and share the setup link with the new admin.
                </p>
              )}
            </div>

            <div className="bg-[#1A1A24] rounded-xl p-4 mb-4">
              <p className="text-xs text-gray-500 mb-2">Setup Link</p>
              <p className="text-sm text-gray-300 break-all leading-relaxed">
                {inviteResult.link}
              </p>
            </div>

            <button
              onClick={copyLink}
              className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
              style={{ background: copied ? 'rgba(76,175,80,0.2)' : '#4CAF50', color: copied ? '#4CAF50' : '#0A1A0A', border: copied ? '1px solid rgba(76,175,80,0.3)' : 'none' }}
            >
              {copied ? <><CheckCircle2 size={16} /> Copied!</> : <><Copy size={16} /> Copy Link</>}
            </button>

            <p className="text-center text-xs text-gray-600 mt-3">
              This link expires in 3 days.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
