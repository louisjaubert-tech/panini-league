'use server'

import { supabaseAdmin } from '@/lib/supabase'

export type LeaderboardRow = {
  rank: number
  userId: string
  username: string
  uniqueCards: number
  completionPct: number
  badgeCount: number
  countries: number
}

export async function fetchLeaderboard(): Promise<LeaderboardRow[]> {
  const [stickersResult, totalRefResult, badgesResult, usersResult] =
    await Promise.all([
      // Toutes les cartes de tous les users (avec le pays via join)
      supabaseAdmin
        .from('scanned_stickers')
        .select('user_id, sticker_id, stickers_reference(country)'),

      // Total de référence
      supabaseAdmin
        .from('stickers_reference')
        .select('*', { count: 'exact', head: true }),

      // Tous les badges
      supabaseAdmin.from('user_badges').select('user_id'),

      // Tous les utilisateurs (auth admin, page 1 — max 1000)
      supabaseAdmin.auth.admin.listUsers({ perPage: 1000, page: 1 }),
    ])

  if (stickersResult.error) {
    console.error('[leaderboard] scanned_stickers:', stickersResult.error.message)
  }
  if (badgesResult.error) {
    console.error('[leaderboard] user_badges:', badgesResult.error.message)
  }

  const totalRef = totalRefResult.count ?? 0

  // ── Agréger par user ────────────────────────────────────────────────────────

  type UserStats = {
    stickerIds: Set<string>
    countries: Set<string>
    badgeCount: number
  }

  const statsMap = new Map<string, UserStats>()

  for (const row of stickersResult.data ?? []) {
    const uid = row.user_id as string
    if (!statsMap.has(uid)) {
      statsMap.set(uid, { stickerIds: new Set(), countries: new Set(), badgeCount: 0 })
    }
    const s = statsMap.get(uid)!
    s.stickerIds.add(row.sticker_id as string)

    const raw = row.stickers_reference
    const ref = (Array.isArray(raw) ? raw[0] : raw) as { country: string } | null
    if (ref?.country) s.countries.add(ref.country)
  }

  for (const row of badgesResult.data ?? []) {
    const uid = row.user_id as string
    if (!statsMap.has(uid)) {
      statsMap.set(uid, { stickerIds: new Set(), countries: new Set(), badgeCount: 0 })
    }
    statsMap.get(uid)!.badgeCount += 1
  }

  // ── Résoudre les usernames ──────────────────────────────────────────────────

  const usernameMap = new Map<string, string>()
  for (const u of usersResult.data?.users ?? []) {
    const name =
      (u.user_metadata?.username as string | undefined) ??
      u.email?.split('@')[0] ??
      'Joueur'
    usernameMap.set(u.id, name)
  }

  // ── Construire + trier ──────────────────────────────────────────────────────

  const rows: Omit<LeaderboardRow, 'rank'>[] = []

  for (const [uid, stats] of statsMap.entries()) {
    const uniqueCards = stats.stickerIds.size
    rows.push({
      userId: uid,
      username: usernameMap.get(uid) ?? 'Joueur',
      uniqueCards,
      completionPct:
        totalRef > 0 ? Math.round((uniqueCards / totalRef) * 100) : 0,
      badgeCount: stats.badgeCount,
      countries: stats.countries.size,
    })
  }

  rows.sort((a, b) => b.uniqueCards - a.uniqueCards)

  return rows.map((row, i) => ({ rank: i + 1, ...row }))
}
