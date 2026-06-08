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
  trophyCount: number
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

  const [profilesResult, collectionsResult, badgesResult, trophiesResult] = await Promise.all([
    supabaseAdmin.from('profiles').select('id, username').in('id', memberIds),
    supabaseAdmin.from('user_collection').select('user_id').in('user_id', memberIds),
    supabaseAdmin.from('user_badges').select('user_id').in('user_id', memberIds),
    supabaseAdmin
      .from('league_trophies')
      .select('user_id')
      .eq('league_id', leagueId)
      .in('user_id', memberIds),
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

  const trophyCount: Record<string, number> = {}
  for (const r of trophiesResult.data ?? []) {
    const uid = r.user_id as string
    trophyCount[uid] = (trophyCount[uid] ?? 0) + 1
  }

  const profileMap = new Map(
    (profilesResult.data ?? []).map((p) => [p.id as string, p.username as string])
  )

  const members: Omit<LeagueMemberRow, 'rank'>[] = memberIds.map((uid) => ({
    userId: uid,
    username: profileMap.get(uid) ?? 'Joueur',
    pct: Math.round(((collectionCount[uid] ?? 0) / TOTAL_STICKERS) * 100),
    badgeCount: badgeCount[uid] ?? 0,
    trophyCount: trophyCount[uid] ?? 0,
    isCurrentUser: uid === currentUserId,
  }))

  members.sort((a, b) => b.pct - a.pct)
  return members.map((m, i) => ({ rank: i + 1, ...m }))
}

export type LeagueTrophyRow = {
  trophy_id: string
  name: string
  username: string
  obtained_at: string
}

// ── fetchTrophyProgress ───────────────────────────────────────────────────────

export type TrophyProgressRow = {
  userId: string
  username: string
  progress: number  // 0–100, arrondi
}

export async function fetchTrophyProgress(
  leagueId: string,
  trophyId: string,
): Promise<TrophyProgressRow[]> {
  // 1. Membres de la ligue
  const { data: memberRows } = await supabaseAdmin
    .from('league_members')
    .select('user_id')
    .eq('league_id', leagueId)

  const memberIds = (memberRows ?? []).map((m) => m.user_id as string)
  if (memberIds.length === 0) return []

  // 2. Profils (usernames)
  const { data: profileRows } = await supabaseAdmin
    .from('profiles')
    .select('id, username')
    .in('id', memberIds)

  const profileMap = new Map(
    (profileRows ?? []).map((p) => [p.id as string, p.username as string ?? 'Joueur'])
  )

  // 3. Collections de tous les membres
  const { data: collRows } = await supabaseAdmin
    .from('user_collection')
    .select('user_id, sticker_id')
    .in('user_id', memberIds)

  // Construire un Map userId → Set<sticker_id>
  const collMap = new Map<string, Set<string>>()
  for (const uid of memberIds) collMap.set(uid, new Set())
  for (const r of collRows ?? []) {
    collMap.get(r.user_id as string)?.add(r.sticker_id as string)
  }

  // 4. Référence stickers (utile pour lt02 et lt04)
  let refRows: { sticker_id: string; country: string }[] = []
  if (trophyId === 'lt02' || trophyId === 'lt04') {
    const { data } = await supabaseAdmin
      .from('stickers_reference')
      .select('sticker_id, country')
    refRows = (data ?? []) as { sticker_id: string; country: string }[]
  }

  // 5. Calcul du % par membre
  function computeProgress(owned: Set<string>): number {
    switch (trophyId) {
      case 'lt01': {
        return Math.min(100, Math.round((owned.size / 960) * 100))
      }
      case 'lt02': {
        // Max % de complétion d'une équipe
        const refByCountry = new Map<string, number>()
        const ownedByCountry = new Map<string, number>()
        for (const r of refRows) {
          if (!r.country) continue
          refByCountry.set(r.country, (refByCountry.get(r.country) ?? 0) + 1)
          if (owned.has(r.sticker_id)) {
            ownedByCountry.set(r.country, (ownedByCountry.get(r.country) ?? 0) + 1)
          }
        }
        let max = 0
        for (const [country, total] of refByCountry.entries()) {
          if (total > 0) {
            const pct = Math.round(((ownedByCountry.get(country) ?? 0) / total) * 100)
            if (pct > max) max = pct
          }
        }
        return Math.min(100, max)
      }
      case 'lt03': {
        const targets = ['106', '107', '108', '109']
        const have = targets.filter(id => owned.has(id)).length
        return Math.round((have / 4) * 100)
      }
      case 'lt04': {
        const fraIds = refRows.filter(r => r.country === 'FRA').map(r => r.sticker_id)
        if (fraIds.length === 0) return 0
        const have = fraIds.filter(id => owned.has(id)).length
        return Math.min(100, Math.round((have / fraIds.length) * 100))
      }
      case 'lt05': {
        const targets = ['JOR15', 'GHA5', 'CIV11', 'SUI17']
        return Math.round((targets.filter(id => owned.has(id)).length / 4) * 100)
      }
      case 'lt06': {
        const targets = ['KOR7', 'KOR8', 'KOR9', 'KOR10', 'KOR12', 'KOR16']
        return Math.round((targets.filter(id => owned.has(id)).length / 6) * 100)
      }
      case 'lt07': {
        const targets = ['ESP10', 'FRA15', 'ARG17', 'POR15', 'CRO9']
        return Math.round((targets.filter(id => owned.has(id)).length / 5) * 100)
      }
      case 'lt08': {
        const have = [...owned].filter(id => id.endsWith('2')).length
        return Math.min(100, Math.round((have / 48) * 100))
      }
      default:
        return 0
    }
  }

  const result: TrophyProgressRow[] = memberIds.map(uid => ({
    userId: uid,
    username: profileMap.get(uid) ?? 'Joueur',
    progress: computeProgress(collMap.get(uid) ?? new Set()),
  }))

  result.sort((a, b) => b.progress - a.progress)
  return result
}

export async function fetchLeagueTrophies(
  leagueId: string,
): Promise<LeagueTrophyRow[]> {
  const { data, error } = await supabaseAdmin
    .from('league_trophies')
    .select('trophy_id, obtained_at, profiles(username)')
    .eq('league_id', leagueId)
    .order('obtained_at', { ascending: true })

  if (error) {
    console.error('[fetchLeagueTrophies]', error.message)
    return []
  }

  const TROPHY_NAMES: Record<string, string> = {
    lt01: 'Trophée Platine',
    lt02: 'Trophée du Pionnier',
    lt03: 'Trophée Jules Rimet',
    lt04: 'Trophée La France',
    lt05: 'Trophée Galette Saucisse',
    lt06: 'Trophée du Repos Bien Mérité',
    lt07: 'Trophée des Grosses Boules Dorées',
    lt08: 'Trophée Lev Yachine',
  }

  return (data ?? []).map((row) => {
    const raw = row.profiles
    const profile = (Array.isArray(raw) ? raw[0] : raw) as { username: string } | null
    return {
      trophy_id: row.trophy_id as string,
      name: TROPHY_NAMES[row.trophy_id as string] ?? row.trophy_id as string,
      username: profile?.username ?? 'Joueur',
      obtained_at: row.obtained_at as string,
    }
  })
}
