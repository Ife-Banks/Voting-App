export interface Position {
  id: string
  title: string
  slug: string
  description: string | null
  display_order: number
  created_at: string
  candidates?: Candidate[]
}

export interface Candidate {
  id: string
  position_id: string
  full_name: string
  photo_url: string | null
  bio: string | null
  vote_count: number
  created_at: string
}

export interface Payment {
  id: string
  candidate_id: string
  position_id: string
  voter_name: string
  voter_email: string
  quantity: number
  price_per_vote_kobo: number
  amount_kobo: number
  tx_ref: string
  flw_transaction_id: number | null
  status: 'pending' | 'success' | 'failed'
  created_at: string
  verified_at: string | null
  candidate?: Candidate
  position?: Position
}

export interface Settings {
  id: number
  award_open: boolean
  price_per_vote_kobo: number
  award_name: string
  school_name: string
  updated_at: string
}

export interface AdminPermissions {
  view_results: boolean
  view_positions: boolean
}

export interface AdminProfile {
  id: string
  user_id: string
  email: string
  name: string
  role: 'super_admin' | 'admin'
  permissions: AdminPermissions
  created_at: string
}

export const DEFAULT_ADMIN_PERMISSIONS: AdminPermissions = {
  view_results: true,
  view_positions: true,
}
