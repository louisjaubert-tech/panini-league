import { supabaseAdmin } from '@/lib/supabaseAdmin'

/** Seuls les stickers d'équipe standard (ESP15, FRA8…) comptent pour les totaux pays */
function isRegularStickerId(id: string): boolean {
  return /^[A-Z]{2,5}\d+$/.test(id)
}

// ════════════════════════════════════════════════════════════
// Types partagés
// ════════════════════════════════════════════════════════════

type StickerRef = {
  sticker_id: string
  country: string
  category: string
}

// ════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════

type BadgeRef = {
  badge_id: string
  name: string
  description: string
  condition_type: string
  condition_value: number
  points: number
}

type CollectionRow = {
  sticker_id: string
  quantity: number
  first_obtained_at: string
  stickers_reference: { country: string } | { country: string }[] | null
}

type Stats = {
  totalUnique: number
  totalDuplicates: number
  countriesCount: number
  countryMap: Map<string, number>
  refCountryTotal: Map<string, number>
  ownedStickerIds: Set<string>
  sessionCards: number
  europeanCountries: Set<string>
}

export type NewBadge = {
  badge_id: string
  name: string
  points: number
}

// ════════════════════════════════════════════════════════════
// Évaluation des conditions
// ════════════════════════════════════════════════════════════

function evaluateBadge(badge: BadgeRef, stats: Stats): boolean {
  const v = badge.condition_value

  switch (badge.condition_type) {
    case 'total_cards':
    case 'unique_cards':
      return stats.totalUnique >= v

    case 'duplicates':
      return stats.totalDuplicates >= v

    case 'countries_count':
      return stats.countriesCount >= v

    case 'same_country':
      for (const count of stats.countryMap.values()) {
        if (count >= v) return true
      }
      return false

    case 'full_country':
      for (const [country, owned] of stats.countryMap.entries()) {
        const expected = stats.refCountryTotal.get(country) ?? 0
        if (expected > 0 && owned >= expected) return true
      }
      return false

    case 'specific_sticker':
      if (badge.badge_id === 'b02') {
        return stats.ownedStickerIds.has('ARG17') && stats.ownedStickerIds.has('POR15')
      }
      return false

    case 'session_cards':
      return stats.sessionCards >= v

    case 'full_continent':
      if (badge.badge_id === 'b09') {
        for (const nation of stats.europeanCountries) {
          if (!stats.countryMap.has(nation)) return false
        }
        return stats.europeanCountries.size > 0
      }
      return false

    default:
      console.warn(`[checkBadges] condition_type inconnu : ${badge.condition_type}`)
      return false
  }
}

// ════════════════════════════════════════════════════════════
// Nations européennes (UEFA)
// ════════════════════════════════════════════════════════════

const EUROPEAN_NATIONS = new Set([
  'Albania', 'Andorra', 'Armenia', 'Austria', 'Azerbaijan',
  'Belarus', 'Belgium', 'Bosnia and Herzegovina', 'Bulgaria',
  'Croatia', 'Cyprus', 'Czech Republic', 'Denmark', 'England',
  'Estonia', 'Faroe Islands', 'Finland', 'France', 'Georgia',
  'Germany', 'Gibraltar', 'Greece', 'Hungary', 'Iceland',
  'Ireland', 'Israel', 'Italy', 'Kazakhstan', 'Kosovo',
  'Latvia', 'Liechtenstein', 'Lithuania', 'Luxembourg', 'Malta',
  'Moldova', 'Montenegro', 'Netherlands', 'North Macedonia',
  'Northern Ireland', 'Norway', 'Poland', 'Portugal', 'Romania',
  'Russia', 'San Marino', 'Scotland', 'Serbia', 'Slovakia',
  'Slovenia', 'Spain', 'Sweden', 'Switzerland', 'Turkey',
  'Ukraine', 'Wales',
])

// ════════════════════════════════════════════════════════════
// Fonction principale exportée
// ════════════════════════════════════════════════════════════

export async function checkBadges(userId: string): Promise<{ new_badges: NewBadge[] }> {
  const { data: collection, error: collErr } = await supabaseAdmin
    .from('user_collection')
    .select('sticker_id, quantity, first_obtained_at, stickers_reference(country)')
    .eq('user_id', userId)

  if (collErr) {
    console.error('[checkBadges] user_collection:', collErr.message)
    throw new Error('Impossible de charger la collection.')
  }

  const rows = (collection ?? []) as CollectionRow[]

  const totalUnique = rows.length
  const totalDuplicates = rows.reduce((sum, r) => sum + (r.quantity > 1 ? r.quantity - 1 : 0), 0)

  const countryMap = new Map<string, number>()
  for (const r of rows) {
    const country =
      (Array.isArray(r.stickers_reference)
        ? (r.stickers_reference[0] as { country: string } | undefined)?.country
        : r.stickers_reference?.country) ?? null
    if (!country) continue
    countryMap.set(country, (countryMap.get(country) ?? 0) + 1)
  }
  const countriesCount = countryMap.size

  const ownedStickerIds = new Set(rows.map(r => r.sticker_id))

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const sessionCards = rows.filter(r => r.first_obtained_at >= tenMinutesAgo).length

  console.log(`[checkBadges] user=${userId} unique=${totalUnique} dupes=${totalDuplicates} countries=${countriesCount} session=${sessionCards}`)

  const { data: allStickers } = await supabaseAdmin
    .from('stickers_reference')
    .select('sticker_id, country')

  // Ne compter que les stickers standard (exclure CC-LAM*, LY…) pour les totaux pays
  const refCountryTotal = new Map<string, number>()
  for (const s of allStickers ?? []) {
    if (!isRegularStickerId(s.sticker_id as string)) continue
    const c = s.country as string
    if (c) refCountryTotal.set(c, (refCountryTotal.get(c) ?? 0) + 1)
  }

  const [{ data: allBadges }, { data: earned }] = await Promise.all([
    supabaseAdmin.from('badges_reference').select('badge_id, name, description, condition_type, condition_value, points'),
    supabaseAdmin.from('user_badges').select('badge_id').eq('user_id', userId),
  ])

  const earnedIds = new Set((earned ?? []).map(e => e.badge_id as string))

  const europeanCountries = new Set(
    (allStickers ?? []).map(s => s.country as string).filter(c => EUROPEAN_NATIONS.has(c))
  )

  const newBadges: NewBadge[] = []

  for (const badge of (allBadges ?? []) as BadgeRef[]) {
    if (earnedIds.has(badge.badge_id)) continue

    const unlocked = evaluateBadge(badge, {
      totalUnique, totalDuplicates, countriesCount,
      countryMap, refCountryTotal, ownedStickerIds,
      sessionCards, europeanCountries,
    })

    if (!unlocked) continue

    const { error: insertErr } = await supabaseAdmin
      .from('user_badges')
      .insert({ user_id: userId, badge_id: badge.badge_id, obtained_at: new Date().toISOString() })

    if (insertErr) {
      console.error(`[checkBadges] insert badge ${badge.badge_id}:`, insertErr.message)
    } else {
      console.log(`[checkBadges] 🏅 nouveau badge : ${badge.badge_id} — ${badge.name}`)
      newBadges.push({ badge_id: badge.badge_id, name: badge.name, points: badge.points })
    }
  }

  // ── Révocation : retirer les badges qui ne sont plus mérités ──────────────
  for (const badge of (allBadges ?? []) as BadgeRef[]) {
    if (!earnedIds.has(badge.badge_id)) continue   // pas encore gagné, rien à révoquer

    const stillValid = evaluateBadge(badge, {
      totalUnique, totalDuplicates, countriesCount,
      countryMap, refCountryTotal, ownedStickerIds,
      sessionCards, europeanCountries,
    })

    if (!stillValid) {
      const { error: delErr } = await supabaseAdmin
        .from('user_badges')
        .delete()
        .eq('user_id', userId)
        .eq('badge_id', badge.badge_id)

      if (delErr) {
        console.error(`[checkBadges] revoke badge ${badge.badge_id}:`, delErr.message)
      } else {
        console.log(`[checkBadges] ❌ badge révoqué : ${badge.badge_id} — ${badge.name}`)
      }
    }
  }

  return { new_badges: newBadges }
}

// ════════════════════════════════════════════════════════════
// checkLeagueTrophies
// ════════════════════════════════════════════════════════════

export type NewTrophy = {
  trophy_id: string
  name: string
}

const LEAGUE_TROPHIES: { trophy_id: string; name: string }[] = [
  { trophy_id: 'lt01', name: 'Trophée Platine' },
  { trophy_id: 'lt02', name: 'Trophée du Pionnier' },
  { trophy_id: 'lt03', name: 'Trophée Jules Rimet' },
  { trophy_id: 'lt04', name: 'Trophée La France' },
  { trophy_id: 'lt05', name: 'Trophée Galette Saucisse' },
  { trophy_id: 'lt06', name: 'Trophée du Repos Bien Mérité' },
  { trophy_id: 'lt07', name: 'Trophée des Grosses Boules Dorées' },
  { trophy_id: 'lt08', name: 'Trophée Lev Yachine' },
]

function checkTrophyCondition(
  trophy_id: string,
  owned: Set<string>,
  allRefs: StickerRef[],
): boolean {
  switch (trophy_id) {
    case 'lt01':
      return owned.size >= 960

    case 'lt02': {
      // Au moins une équipe nationale complète
      const refByCountry = new Map<string, number>()
      const ownedByCountry = new Map<string, number>()
      for (const r of allRefs) {
        if (!r.country) continue
        refByCountry.set(r.country, (refByCountry.get(r.country) ?? 0) + 1)
        if (owned.has(r.sticker_id)) {
          ownedByCountry.set(r.country, (ownedByCountry.get(r.country) ?? 0) + 1)
        }
      }
      for (const [country, total] of refByCountry.entries()) {
        if (total > 0 && (ownedByCountry.get(country) ?? 0) >= total) return true
      }
      return false
    }

    case 'lt03':
      return ['106', '107', '108', '109'].every((id) => owned.has(id))

    case 'lt04': {
      // Tous les stickers country = 'FRA'
      const fraIds = allRefs.filter((r) => r.country === 'FRA').map((r) => r.sticker_id)
      return fraIds.length > 0 && fraIds.every((id) => owned.has(id))
    }

    case 'lt05':
      return ['JOR15', 'GHA5', 'CIV11', 'SUI17'].every((id) => owned.has(id))

    case 'lt06':
      return ['KOR7', 'KOR8', 'KOR9', 'KOR10', 'KOR12', 'KOR16'].every((id) => owned.has(id))

    case 'lt07':
      return ['ESP10', 'FRA15', 'ARG17', 'POR15', 'CRO9'].every((id) => owned.has(id))

    case 'lt08': {
      // Tous les stickers dont sticker_id se termine par '2' ET category = 'Player'
      const targets = allRefs.filter(
        (r) => r.sticker_id.endsWith('2') && r.category === 'Player',
      )
      return targets.length > 0 && targets.every((r) => owned.has(r.sticker_id))
    }

    default:
      return false
  }
}

export async function checkLeagueTrophies(
  userId: string,
  leagueId: string,
): Promise<NewTrophy[]> {
  // 1. Collection de l'utilisateur
  const { data: collectionRows, error: collErr } = await supabaseAdmin
    .from('user_collection')
    .select('sticker_id')
    .eq('user_id', userId)

  if (collErr) {
    console.error('[checkLeagueTrophies] user_collection:', collErr.message)
    return []
  }

  const owned = new Set((collectionRows ?? []).map((r) => r.sticker_id as string))

  // 2. Référence complète des stickers (besoin de country + category)
  const { data: refRows, error: refErr } = await supabaseAdmin
    .from('stickers_reference')
    .select('sticker_id, country, category')

  if (refErr) {
    console.error('[checkLeagueTrophies] stickers_reference:', refErr.message)
    return []
  }

  const allRefs = (refRows ?? []) as StickerRef[]

  // 3. Trophées déjà attribués dans cette ligue
  const { data: existing, error: existErr } = await supabaseAdmin
    .from('league_trophies')
    .select('trophy_id')
    .eq('league_id', leagueId)

  if (existErr) {
    console.error('[checkLeagueTrophies] league_trophies fetch:', existErr.message)
    return []
  }

  const alreadyAwarded = new Set((existing ?? []).map((r) => r.trophy_id as string))

  // 4. Vérifier et attribuer les nouveaux trophées
  const newTrophies: NewTrophy[] = []

  for (const trophy of LEAGUE_TROPHIES) {
    // Ce trophée a déjà été remporté dans cette ligue par quelqu'un
    if (alreadyAwarded.has(trophy.trophy_id)) continue

    const unlocked = checkTrophyCondition(trophy.trophy_id, owned, allRefs)
    if (!unlocked) continue

    const { error: insertErr } = await supabaseAdmin
      .from('league_trophies')
      .insert({
        league_id: leagueId,
        user_id: userId,
        trophy_id: trophy.trophy_id,
        obtained_at: new Date().toISOString(),
      })

    if (insertErr) {
      // Code 23505 = violation contrainte UNIQUE → quelqu'un a gagné entre-temps
      if (insertErr.code !== '23505') {
        console.error(`[checkLeagueTrophies] insert ${trophy.trophy_id}:`, insertErr.message)
      }
    } else {
      console.log(`[checkLeagueTrophies] 🏆 nouveau trophée : ${trophy.trophy_id} — ${trophy.name} (league=${leagueId})`)
      newTrophies.push({ trophy_id: trophy.trophy_id, name: trophy.name })
    }
  }

  return newTrophies
}
