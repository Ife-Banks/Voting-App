export interface Student {
  id: string
  email: string
  has_logged_in: boolean
  has_voted: boolean
  created_at: string
}

export interface Position {
  id: string
  title: string
  description: string | null
  display_order: number
  created_at: string
  candidates?: Candidate[]
}

export interface Candidate {
  id: string
  position_id: string
  full_name: string
  class: string | null
  manifesto: string | null
  photo_url: string | null
  vote_count: number
  created_at: string
}

export interface Vote {
  id: string
  student_email: string
  position_id: string
  candidate_id: string
  created_at: string
}

export interface Settings {
  id: number
  voting_open: boolean
  election_name: string
  school_name: string
  updated_at: string
}

export interface VoteSelection {
  [positionId: string]: string // positionId -> candidateId
}

export interface VotingSession {
  id: string
  title: string
  is_active: boolean
  created_at: string
  ended_at: string | null
}
