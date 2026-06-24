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
  uniqueCards: number
  duplicates: number
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
    supabaseAdmin.from('user_collection').select('user_id, sticker_id, quantity').in('user_id', memberIds),
    supabaseAdmin.from('user_badges').select('user_id').in('user_id', memberIds),
    supabaseAdmin
      .from('league_trophies')
      .select('user_id')
      .eq('league_id', leagueId)
      .in('user_id', memberIds),
  ])

  const REGULAR_ID = /^[A-Z]{2,5}\d+$/
  const collectionCount: Record<string, number> = {}
  const duplicatesCount: Record<string, number> = {}
  for (const r of collectionsResult.data ?? []) {
    const uid = r.user_id as string
    const sid = r.sticker_id as string
    if (!REGULAR_ID.test(sid)) continue   // exclure CC-LAM*, LY, KM…
    const qty = r.quantity as number ?? 1
    collectionCount[uid] = (collectionCount[uid] ?? 0) + 1
    if (qty > 1) duplicatesCount[uid] = (duplicatesCount[uid] ?? 0) + (qty - 1)
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

  const members: Omit<LeagueMemberRow, 'rank'>[] = memberIds.map((uid) => {
    const unique = collectionCount[uid] ?? 0
    return {
      userId: uid,
      username: profileMap.get(uid) ?? 'Joueur',
      uniqueCards: unique,
      duplicates: duplicatesCount[uid] ?? 0,
      pct: Math.round((unique / TOTAL_STICKERS) * 100),
      badgeCount: badgeCount[uid] ?? 0,
      trophyCount: trophyCount[uid] ?? 0,
      isCurrentUser: uid === currentUserId,
    }
  })

  members.sort((a, b) => b.uniqueCards - a.uniqueCards)
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

  const B19_TARGETS = [
    'ENG16', 'ENG12', 'ENG6',
    'FRA10', 'FRA18', 'FRA19',
    'GER2',  'GER16', 'GER19',
    'ESP7',  'ESP19', 'ESP3', 'ESP5',
    'BRA15', 'BRA5',  'BRA20', 'BRA16',
    'NED15', 'NED8',  'NED5',
    'BEL19', 'ARG15',
    'GHA14', 'MAR16', 'MAR6', 'CIV16',
    'ALG8',  'MEX15', 'SWE17', 'JPN16',
  ]

  // 4. Référence stickers (utile pour b12 et b14)
  let refRows: { sticker_id: string; country: string }[] = []
  if (trophyId === 'b12' || trophyId === 'b14') {
    const { data } = await supabaseAdmin
      .from('stickers_reference')
      .select('sticker_id, country')
    refRows = (data ?? []) as { sticker_id: string; country: string }[]
  }

  // 5. Calcul du % par membre
  function computeProgress(owned: Set<string>): number {
    switch (trophyId) {
      case 'b11': {
        return Math.min(100, Math.round((owned.size / 960) * 100))
      }
      case 'b12': {
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
      case 'b13': {
        const targets = ['106', '107', '108', '109']
        const have = targets.filter(id => owned.has(id)).length
        return Math.round((have / 4) * 100)
      }
      case 'b14': {
        const fraIds = refRows.filter(r => r.country === 'France').map(r => r.sticker_id)
        if (fraIds.length === 0) return 0
        const have = fraIds.filter(id => owned.has(id)).length
        return Math.min(100, Math.round((have / fraIds.length) * 100))
      }
      case 'b15': {
        const targets = ['JOR15', 'GHA5', 'CIV11', 'SUI17']
        return Math.round((targets.filter(id => owned.has(id)).length / 4) * 100)
      }
      case 'b16': {
        const targets = ['KOR7', 'KOR8', 'KOR9', 'KOR10', 'KOR12', 'KOR16']
        return Math.round((targets.filter(id => owned.has(id)).length / 6) * 100)
      }
      case 'b17': {
        const targets = ['ESP10', 'FRA15', 'ARG17', 'POR15', 'CRO9']
        return Math.round((targets.filter(id => owned.has(id)).length / 5) * 100)
      }
      case 'b18': {
        const have = [...owned].filter(id => id.endsWith('2')).length
        return Math.min(100, Math.round((have / 48) * 100))
      }
      case 'b19': {
        const have = B19_TARGETS.filter(id => owned.has(id)).length
        return Math.round((have / B19_TARGETS.length) * 100)
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
    b11: 'Trophée Platine',
    b12: 'Trophée Équipe Complète',
    b13: 'Trophée Jules Rimet',
    b14: 'Trophée La France',
    b15: 'Trophée Galette Saucisse',
    b16: 'Trophée Repos Bien Mérité',
    b17: 'Trophée Grosses Boules Dorées',
    b18: 'Trophée Lev Yachine',
    b19: 'Trophée Erreurs de Casting',
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

// ── fetchLeagueMemberBadges ───────────────────────────────────────────────────

export type LeagueBadgeRow = {
  badge_id: string
  name: string
  points: number
  earners: { username: string; obtained_at: string }[]
}

export async function fetchLeagueMemberBadges(leagueId: string): Promise<LeagueBadgeRow[]> {
  const { data: memberRows } = await supabaseAdmin
    .from('league_members')
    .select('user_id')
    .eq('league_id', leagueId)

  const memberIds = (memberRows ?? []).map((m) => m.user_id as string)
  if (memberIds.length === 0) return []

  const [profilesResult, badgesResult, badgeRefResult] = await Promise.all([
    supabaseAdmin.from('profiles').select('id, username').in('id', memberIds),
    supabaseAdmin
      .from('user_badges')
      .select('user_id, badge_id, obtained_at')
      .in('user_id', memberIds)
      .order('obtained_at', { ascending: true }),
    supabaseAdmin
      .from('badges_reference')
      .select('badge_id, name, points')
      .order('badge_id', { ascending: true }),
  ])

  const profileMap = new Map(
    (profilesResult.data ?? []).map((p) => [p.id as string, p.username as string ?? 'Joueur']),
  )

  // Grouper par badge_id
  const badgeMap = new Map<string, { username: string; obtained_at: string }[]>()
  for (const row of badgesResult.data ?? []) {
    const bid = row.badge_id as string
    const username = profileMap.get(row.user_id as string) ?? 'Joueur'
    if (!badgeMap.has(bid)) badgeMap.set(bid, [])
    badgeMap.get(bid)!.push({ username, obtained_at: row.obtained_at as string })
  }

  return (badgeRefResult.data ?? []).map((ref) => ({
    badge_id: ref.badge_id as string,
    name: ref.name as string,
    points: ref.points as number,
    earners: badgeMap.get(ref.badge_id as string) ?? [],
  }))
}
