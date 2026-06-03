'use server'

import { cookies } from 'next/headers'
import { supabase, supabaseAdmin } from '@/lib/supabase'

export type Badge = {
  id: string
  name: string
  icon: string
  description: string
  earned_at: string
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

  const [
    uniqueResult,
    totalRefResult,
    duplicatesResult,
    countriesResult,
    badgesResult,
    packsResult,
  ] = await Promise.all([
    // Nombre de cartes uniques
    supabaseAdmin
      .from('user_stickers')
      .select('sticker_id', { count: 'exact', head: true })
      .eq('user_id', uid),

    // Total de la référence
    supabaseAdmin
      .from('stickers_reference')
      .select('*', { count: 'exact', head: true }),

    // Doublons : somme de (quantity - 1) pour les cartes en double
    supabaseAdmin
      .from('user_stickers')
      .select('quantity')
      .eq('user_id', uid)
      .gt('quantity', 1),

    // Pays distincts présents dans la collection
    supabaseAdmin
      .from('user_stickers')
      .select('stickers_reference!inner(country)')
      .eq('user_id', uid),

    // 3 derniers badges
    supabaseAdmin
      .from('user_badges')
      .select(`
        earned_at,
        badges_reference (
          id,
          name,
          icon,
          description
        )
      `)
      .eq('user_id', uid)
      .order('earned_at', { ascending: false })
      .limit(3),

    // 5 derniers blisters
    supabaseAdmin
      .from('pack_openings')
      .select('*')
      .eq('user_id', uid)
      .order('opened_at', { ascending: false })
      .limit(5),
  ])

  const uniqueCards = uniqueResult.count ?? 0
  const totalReference = totalRefResult.count ?? 0
  const completionPct =
    totalReference > 0 ? Math.round((uniqueCards / totalReference) * 100) : 0

  const duplicates =
    duplicatesResult.data?.reduce(
      (sum, row) => sum + ((row.quantity as number) - 1),
      0
    ) ?? 0

  const countriesSet = new Set<string>()
  if (countriesResult.data) {
    for (const row of countriesResult.data) {
      const raw = row.stickers_reference
      const ref = (Array.isArray(raw) ? raw[0] : raw) as { country: string } | null
      if (ref?.country) countriesSet.add(ref.country)
    }
  }

  const recentBadges: Badge[] =
    badgesResult.data
      ?.map((row) => {
        const rawRef = row.badges_reference
        const ref = (Array.isArray(rawRef) ? rawRef[0] : rawRef) as {
          id: string
          name: string
          icon: string
          description: string
        } | null
        if (!ref) return null
        return {
          id: ref.id,
          name: ref.name,
          icon: ref.icon,
          description: ref.description,
          earned_at: row.earned_at as string,
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
    countries: countriesSet.size,
    recentBadges,
    recentPacks,
  }
}
