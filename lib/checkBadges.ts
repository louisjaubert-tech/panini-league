import { supabaseAdmin } from '@/lib/supabaseAdmin'

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
        for (const id of stats.ownedStickerIds) {
          if (id.toUpperCase().includes('MESSI')) return true
        }
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

  const refCountryTotal = new Map<string, number>()
  for (const s of allStickers ?? []) {
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

  return { new_badges: newBadges }
}
