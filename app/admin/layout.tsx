'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import {
  LayoutDashboard, Users, Award, BarChart2,
  LogOut, Vote, ChevronRight, Calendar, Menu, X
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
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const isLoginPage = pathname === '/admin/login'

  useEffect(() => {
    if (isLoginPage) return
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

  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (isLoginPage) return <>{children}</>

  const sidebarContent = (
    <>
      <div className="px-4 lg:px-6 py-4 lg:py-6 border-b flex items-center gap-3"
        style={{ borderColor: 'rgba(201,168,76,0.12)' }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, #1A4A3A, #2D6B54)', border: '1px solid rgba(201,168,76,0.3)' }}>
          <Vote size={18} style={{ color: '#C9A84C' }} />
        </div>
        {!sidebarCollapsed && (
          <div className="overflow-hidden">
            <p className="text-xs font-semibold gold-text leading-tight truncate">{electionName}</p>
            <p className="text-xs" style={{ color: 'rgba(245,240,232,0.35)' }}>Admin Panel</p>
          </div>
        )}
      </div>

      <nav className="flex-1 px-2 lg:px-3 py-4 space-y-1">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== '/admin/dashboard' && pathname.startsWith(href))
          return (
            <Link key={href} href={href}
              className={`sidebar-item flex items-center gap-3 px-3 py-2.5 text-sm ${active ? 'active' : ''}`}
              style={{ color: active ? '#C9A84C' : 'rgba(245,240,232,0.6)' }}>
              <Icon size={16} className="shrink-0" />
              {!sidebarCollapsed && <span className="truncate">{label}</span>}
              {active && !sidebarCollapsed && <ChevronRight size={14} className="ml-auto shrink-0" />}
            </Link>
          )
        })}
      </nav>

      <div className="px-2 lg:px-3 pb-6">
        <button onClick={logout}
          className="sidebar-item w-full flex items-center gap-3 px-3 py-2.5 text-sm"
          style={{ color: 'rgba(245,240,232,0.4)' }}>
          <LogOut size={16} className="shrink-0" />
          {!sidebarCollapsed && <span>Sign Out</span>}
        </button>
      </div>
    </>
  )

  return (
    <div className="min-h-screen flex">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* Mobile sidebar (overlay) */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 flex flex-col transition-transform duration-300 lg:hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: 'rgba(10,10,15,0.98)', borderRight: '1px solid rgba(201,168,76,0.12)' }}>
        <div className="flex items-center justify-between px-4 py-4 border-b" style={{ borderColor: 'rgba(201,168,76,0.12)' }}>
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
          <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-lg hover:bg-white/5">
            <X size={18} style={{ color: '#F5F0E8' }} />
          </button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== '/admin/dashboard' && pathname.startsWith(href))
            return (
              <Link key={href} href={href}
                className={`sidebar-item flex items-center gap-3 px-3 py-2.5 text-sm ${active ? 'active' : ''}`}
                style={{ color: active ? '#C9A84C' : 'rgba(245,240,232,0.6)' }}>
                <Icon size={16} className="shrink-0" />
                <span className="truncate">{label}</span>
                {active && <ChevronRight size={14} className="ml-auto shrink-0" />}
              </Link>
            )
          })}
        </nav>
        <div className="px-3 pb-6">
          <button onClick={logout}
            className="sidebar-item w-full flex items-center gap-3 px-3 py-2.5 text-sm"
            style={{ color: 'rgba(245,240,232,0.4)' }}>
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Desktop sidebar */}
      <aside className={`hidden lg:flex flex-col transition-all duration-300 ${sidebarCollapsed ? 'w-16' : 'w-64'} shrink-0 border-r`}
        style={{ borderColor: 'rgba(201,168,76,0.12)', background: 'rgba(10,10,15,0.95)' }}>
        {sidebarContent}
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-auto">
        {/* Top bar with mobile menu + collapse buttons */}
        <div className="sticky top-0 z-30 flex items-center gap-3 px-4 lg:px-6 py-3 border-b lg:hidden"
          style={{ borderColor: 'rgba(201,168,76,0.12)', background: 'rgba(10,10,15,0.95)', backdropFilter: 'blur(12px)' }}>
          <button onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-1 rounded-lg hover:bg-white/5">
            <Menu size={20} style={{ color: '#F5F0E8' }} />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #1A4A3A, #2D6B54)' }}>
              <Vote size={14} style={{ color: '#C9A84C' }} />
            </div>
            <p className="text-sm font-semibold gold-text truncate">{electionName}</p>
          </div>
        </div>

        {/* Desktop collapse toggle */}
        <div className="hidden lg:block">
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="fixed left-[13px] bottom-6 z-30 p-1.5 rounded-lg transition-opacity hover:bg-white/5"
            style={{ color: 'rgba(245,240,232,0.3)' }}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            <ChevronRight size={14} className={`transition-transform duration-300 ${sidebarCollapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        <div className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
