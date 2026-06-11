'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import type { Student } from '@/lib/types'
import { Plus, Trash2, Upload, Search, CheckCircle2, Circle, Loader2, X, Download } from 'lucide-react'

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [adding, setAdding] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [showBulk, setShowBulk] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const supabase = createClient()
    const { data } = await supabase.from('students').select('*').order('email')
    if (data) setStudents(data)
    setLoading(false)
  }

  async function addStudent() {
    const email = newEmail.trim().toLowerCase()
    if (!email) return
    setAdding(true)
    const supabase = createClient()
    const { data, error } = await supabase.from('students').insert({ email }).select().single()
    if (data) { setStudents(prev => [...prev, data].sort((a, b) => a.email.localeCompare(b.email))); setNewEmail('') }
    else if (error) alert('Email already exists or invalid.')
    setAdding(false)
  }

  async function deleteStudent(id: string, hasVoted: boolean) {
    if (hasVoted && !confirm('This student has already voted. Remove them anyway?')) return
    if (!hasVoted && !confirm('Remove this student?')) return
    const supabase = createClient()
    await supabase.from('students').delete().eq('id', id)
    setStudents(prev => prev.filter(s => s.id !== id))
  }

  async function resetVote(id: string, email: string) {
    if (!confirm(`Reset vote for ${email}? They will be able to vote again.`)) return
    const supabase = createClient()
    await supabase.from('students').update({ has_voted: false }).eq('id', id)
    await supabase.from('votes').delete().eq('student_email', email)
    setStudents(prev => prev.map(s => s.id === id ? { ...s, has_voted: false } : s))
  }

  async function addBulk() {
    const emails = bulkText.split('\n').map(e => e.trim().toLowerCase()).filter(e => e && e.includes('@'))
    if (!emails.length) { alert('No valid emails found.'); return }
    setBulkLoading(true)
    const supabase = createClient()
    const rows = emails.map(email => ({ email }))
    const { data, error } = await supabase.from('students').upsert(rows, { onConflict: 'email' }).select()
    if (data) {
      await load()
      setBulkText('')
      setShowBulk(false)
      alert(`Added/updated ${data.length} student(s)`)
    }
    setBulkLoading(false)
  }

  function exportCSV() {
    const csv = ['Email,Has Voted', ...students.map(s => `${s.email},${s.has_voted}`)].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'students.csv'; a.click()
  }

  const filtered = students.filter(s => s.email.toLowerCase().includes(search.toLowerCase()))
  const votedCount = students.filter(s => s.has_voted).length

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold gold-text mb-1">Students</h1>
          <p className="text-sm" style={{ color: 'rgba(245,240,232,0.45)' }}>
            {students.length} registered · {votedCount} voted · {students.length - votedCount} pending
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="btn-ghost px-4 py-2.5 rounded-xl text-sm flex items-center gap-2">
            <Download size={14} /> Export
          </button>
          <button onClick={() => setShowBulk(true)}
            className="btn-ghost px-4 py-2.5 rounded-xl text-sm flex items-center gap-2">
            <Upload size={14} /> Bulk Import
          </button>
        </div>
      </div>

      {/* Add single */}
      <div className="glass-card rounded-2xl p-5 mb-6">
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'rgba(245,240,232,0.7)' }}>Add Student Email</h3>
        <div className="flex gap-3">
          <input value={newEmail} onChange={e => setNewEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addStudent()}
            className="input-field flex-1 px-4 py-2.5 rounded-xl text-sm"
            placeholder="student@school.edu.ng" type="email" />
          <button onClick={addStudent} disabled={adding}
            className="btn-gold px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 shrink-0">
            {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Add
          </button>
        </div>
      </div>

      {/* Bulk import modal */}
      {showBulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(10,10,15,0.85)', backdropFilter: 'blur(8px)' }}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-xl font-semibold" style={{ color: '#F5F0E8' }}>Bulk Import</h3>
              <button onClick={() => setShowBulk(false)}><X size={18} style={{ color: 'rgba(245,240,232,0.4)' }} /></button>
            </div>
            <p className="text-xs mb-3" style={{ color: 'rgba(245,240,232,0.45)' }}>
              Paste one email address per line. Duplicate emails will be skipped.
            </p>
            <textarea value={bulkText} onChange={e => setBulkText(e.target.value)}
              className="input-field w-full px-4 py-3 rounded-xl text-sm resize-none mb-4"
              rows={10} placeholder="student1@school.edu.ng&#10;student2@school.edu.ng&#10;student3@school.edu.ng" />
            <div className="flex gap-3">
              <button onClick={addBulk} disabled={bulkLoading}
                className="btn-gold flex-1 py-3 rounded-xl text-sm flex items-center justify-center gap-2">
                {bulkLoading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                Import Emails
              </button>
              <button onClick={() => setShowBulk(false)} className="btn-ghost px-5 py-3 rounded-xl text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'rgba(245,240,232,0.3)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)}
          className="input-field w-full pl-11 pr-4 py-2.5 rounded-xl text-sm"
          placeholder="Search students..." />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin" style={{ color: '#C9A84C' }} /></div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b" style={{ borderColor: 'rgba(201,168,76,0.1)' }}>
                <th className="text-left px-6 py-3 text-xs font-semibold" style={{ color: 'rgba(245,240,232,0.4)' }}>Email</th>
                <th className="text-center px-6 py-3 text-xs font-semibold" style={{ color: 'rgba(245,240,232,0.4)' }}>Status</th>
                <th className="text-right px-6 py-3 text-xs font-semibold" style={{ color: 'rgba(245,240,232,0.4)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={3} className="text-center py-12 text-sm" style={{ color: 'rgba(245,240,232,0.25)' }}>
                  {search ? 'No students match your search' : 'No students added yet'}
                </td></tr>
              )}
              {filtered.map((student, i) => (
                <tr key={student.id}
                  className={`border-b transition-colors hover:bg-white/[0.02] ${i === filtered.length - 1 ? 'border-transparent' : ''}`}
                  style={{ borderColor: 'rgba(201,168,76,0.06)' }}>
                  <td className="px-6 py-3.5">
                    <p className="text-sm" style={{ color: '#F5F0E8' }}>{student.email}</p>
                  </td>
                  <td className="px-6 py-3.5 text-center">
                    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${student.has_voted ? 'badge-open' : 'badge-closed'}`}>
                      {student.has_voted
                        ? <><CheckCircle2 size={11} /> Voted</>
                        : <><Circle size={11} /> Pending</>}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {student.has_voted && (
                        <button onClick={() => resetVote(student.id, student.email)}
                          className="text-xs hover:underline transition-colors"
                          style={{ color: 'rgba(201,168,76,0.6)' }}>Reset vote</button>
                      )}
                      <button onClick={() => deleteStudent(student.id, student.has_voted)}
                        className="p-1.5 rounded-lg hover:bg-red-900/20 transition-colors"
                        style={{ color: '#E74C3C' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  )
}
