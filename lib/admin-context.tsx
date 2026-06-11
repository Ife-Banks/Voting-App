'use client'

import { createContext, useContext } from 'react'
import type { AdminProfile } from '@/lib/types'

interface AdminCtx {
  profile: AdminProfile | null
  loading: boolean
}

const AdminContext = createContext<AdminCtx>({ profile: null, loading: true })

export function useAdminProfile() {
  return useContext(AdminContext)
}

export { AdminContext }
