'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'

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
  const [collectionResult, totalRefResult, badgesResult, profilesResult] =
    await Promise.all([
      // Toutes les cartes de la collection (avec le pays via join)
      supabaseAdmin
        .from('user_collection')
        .select('user_id, sticker_id, stickers_reference!inner(country)'),

      // Total de référence
      supabaseAdmin
        .from('stickers_reference')
        .select('*', { count: 'exact', head: true }),

      // Tous les badges
      supabaseAdmin.from('user_badges').select('user_id'),

      // Tous les profils (usernames)
      supabaseAdmin.from('profiles').select('id, username'),
    ])

  if (collectionResult.error) {
    console.error('[leaderboard] user_collection:', collectionResult.error.message)
  }
  if (badgesResult.error) {
    console.error('[leaderboard] user_badges:', badgesResult.error.message)
  }
  if (profilesResult.error) {
    console.error('[leaderboard] profiles:', profilesResult.error.message)
  }

  const totalRef = totalRefResult.count ?? 0

  // ── Agréger par user ────────────────────────────────────────────────────────

  type UserStats = {
    stickerIds: Set<string>
    countries: Set<string>
    badgeCount: number
  }

  const statsMap = new Map<string, UserStats>()

  for (const row of collectionResult.data ?? []) {
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

  // ── Résoudre les usernames depuis profiles ──────────────────────────────────

  const usernameMap = new Map<string, string>()
  for (const profile of profilesResult.data ?? []) {
    usernameMap.set(
      profile.id as string,
      (profile.username as string | null) ?? 'Joueur',
    )
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
