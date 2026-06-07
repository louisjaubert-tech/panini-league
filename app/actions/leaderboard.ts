'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { TOTAL_STICKERS } from '@/lib/stats'

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
  const [collectionResult, badgesResult, profilesResult] =
    await Promise.all([
      // Toutes les cartes de la collection (avec le pays via join)
      supabaseAdmin
        .from('user_collection')
        .select('user_id, sticker_id, stickers_reference!inner(country)'),

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

  const totalRef = TOTAL_STICKERS

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

export type LeagueMemberRow = {
  rank: number
  userId: string
  username: string
  pct: number
  badgeCount: number
  isCurrentUser: boolean
}

export async function fetchLeagueLeaderboard(
  leagueId: string,
  currentUserId: string,
): Promise<LeagueMemberRow[]> {
  const { data: memberRows } = await supabaseAdmin
    .from('league_members')
    .select('user_id')
    .eq('league_id', leagueId)

  const memberIds = (memberRows ?? []).map((m) => m.user_id as string)
  if (memberIds.length === 0) return []

  const [profilesResult, collectionsResult, badgesResult] = await Promise.all([
    supabaseAdmin.from('profiles').select('id, username').in('id', memberIds),
    supabaseAdmin.from('user_collection').select('user_id').in('user_id', memberIds),
    supabaseAdmin.from('user_badges').select('user_id').in('user_id', memberIds),
  ])

  const collectionCount: Record<string, number> = {}
  for (const r of collectionsResult.data ?? []) {
    const uid = r.user_id as string
    collectionCount[uid] = (collectionCount[uid] ?? 0) + 1
  }

  const badgeCount: Record<string, number> = {}
  for (const r of badgesResult.data ?? []) {
    const uid = r.user_id as string
    badgeCount[uid] = (badgeCount[uid] ?? 0) + 1
  }

  const profileMap = new Map(
    (profilesResult.data ?? []).map((p) => [p.id as string, p.username as string])
  )

  const members: Omit<LeagueMemberRow, 'rank'>[] = memberIds.map((uid) => ({
    userId: uid,
    username: profileMap.get(uid) ?? 'Joueur',
    pct: Math.round(((collectionCount[uid] ?? 0) / TOTAL_STICKERS) * 100),
    badgeCount: badgeCount[uid] ?? 0,
    isCurrentUser: uid === currentUserId,
  }))

  members.sort((a, b) => b.pct - a.pct)
  return members.map((m, i) => ({ rank: i + 1, ...m }))
}
