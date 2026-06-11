'use server'

import { cookies } from 'next/headers'
import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getUserStats, TOTAL_STICKERS } from '@/lib/stats'

export type Badge = {
  badge_id: string
  name: string
  description: string
  obtained_at: string
}

export type PackOpening = {
  id: string
  photo_url: string
  ocr_status: string
  opened_at: string
}

export type DashboardData = {
  uniqueCards: number
  totalReference: number
  completionPct: number
  duplicates: number
  countries: number
  recentBadges: Badge[]
  recentPacks: PackOpening[]
  totalPacks: number
}

export async function fetchDashboardData(): Promise<DashboardData | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('sb-access-token')?.value
  if (!token) return null

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token)
  if (authError || !user) return null

  const uid = user.id

  const [stats, badgesResult, packsResult, packsCountResult] = await Promise.all([
    getUserStats(uid),

    // 3 derniers badges
    supabaseAdmin
      .from('user_badges')
      .select(`
        obtained_at,
        badges_reference (
          badge_id,
          name,
          description
        )
      `)
      .eq('user_id', uid)
      .order('obtained_at', { ascending: false })
      .limit(3),

    // 5 derniers blisters
    supabaseAdmin
      .from('pack_openings')
      .select('*')
      .eq('user_id', uid)
      .order('opened_at', { ascending: false })
      .limit(5),

    // Total blisters scannés (hors annulés)
    supabaseAdmin
      .from('pack_openings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', uid)
      .neq('ocr_status', 'cancelled'),
  ])

  const uniqueCards   = stats.unique
  const totalReference = TOTAL_STICKERS
  const completionPct  = stats.percentage
  const duplicates     = stats.duplicates

  const recentBadges: Badge[] =
    badgesResult.data
      ?.map((row) => {
        const rawRef = row.badges_reference
        const ref = (Array.isArray(rawRef) ? rawRef[0] : rawRef) as {
          badge_id: string
          name: string
          description: string
        } | null
        if (!ref) return null
        return {
          badge_id: ref.badge_id,
          name: ref.name,
          description: ref.description,
          obtained_at: row.obtained_at as string,
        }
      })
      .filter(Boolean) as Badge[] ?? []

  if (packsResult.error) {
    console.error('[dashboard] pack_openings error:', packsResult.error.message)
  }

  const recentPacks: PackOpening[] =
    (packsResult.data as PackOpening[] | null) ?? []

  return {
    uniqueCards,
    totalReference,
    completionPct,
    duplicates,
    countries: stats.countries,
    recentBadges,
    recentPacks,
    totalPacks: packsCountResult.count ?? 0,
  }
}
