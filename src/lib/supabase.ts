import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Transaction = {
  id: string
  user_id: string
  type: 'income' | 'expense'
  amount: number
  category: string
  description: string
  date: string
  created_at: string
}

export type Goal = {
  id: string
  user_id: string
  name: string
  target_amount: number
  current_amount: number
  deadline?: string
  created_at: string
  updated_at: string
}

export type Achievement = {
  id: string
  user_id: string
  title: string
  description: string
  xp: number
  unlocked_at: string
}

export type UserProfile = {
  user_id: string
  xp: number
  level: number
  total_saved: number
  updated_at: string
}
