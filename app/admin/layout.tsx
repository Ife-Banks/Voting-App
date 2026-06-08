'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import {
  LayoutDashboard, Users, Award, BarChart2,
  LogOut, Vote, Settings, ChevronRight, Calendar
} from 'lucide-react'

const navItems = [
  { href: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/admin/sessions', icon: Calendar, label: 'Sessions' },
  { href: '/admin/positions', icon: Award, label: 'Positions & Candidates' },
  { href: '/admin/students', icon: Users, label: 'Students' },
  { href: '/admin/results', icon: BarChart2, label: 'Results' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [electionName, setElectionName] = useState('SRC Elections')
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  useEffect(() => {
    if (pathname === '/admin/login') return
    async function check() {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user || user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
        router.push('/admin/login')
        return
      }
      const { data } = await supabase.from('settings').select('election_name').single()
      if (data) setElectionName(data.election_name)
    }
    check()
  }, [pathname])

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 flex flex-col border-r"
        style={{ borderColor: 'rgba(201,168,76,0.12)', background: 'rgba(10,10,15,0.95)' }}>
        {/* Brand */}
        <div className="px-6 py-6 border-b" style={{ borderColor: 'rgba(201,168,76,0.12)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #1A4A3A, #2D6B54)', border: '1px solid rgba(201,168,76,0.3)' }}>
              <Vote size={18} style={{ color: '#C9A84C' }} />
            </div>
            <div>
              <p className="text-xs font-semibold gold-text leading-tight">{electionName}</p>
              <p className="text-xs" style={{ color: 'rgba(245,240,232,0.35)' }}>Admin Panel</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== '/admin/dashboard' && pathname.startsWith(href))
            return (
              <Link key={href} href={href}
                className={`sidebar-item flex items-center gap-3 px-3 py-2.5 text-sm ${active ? 'active' : ''}`}
                style={{ color: active ? '#C9A84C' : 'rgba(245,240,232,0.6)' }}>
                <Icon size={16} />
                {label}
                {active && <ChevronRight size={14} className="ml-auto" />}
              </Link>
            )
          })}
        </nav>

        {/* Logout */}
        <div className="px-3 pb-6">
          <button onClick={logout}
            className="sidebar-item w-full flex items-center gap-3 px-3 py-2.5 text-sm"
            style={{ color: 'rgba(245,240,232,0.4)' }}>
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
