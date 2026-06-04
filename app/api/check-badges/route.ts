import { NextRequest, NextResponse } from 'next/server'
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

// ════════════════════════════════════════════════════════════
// POST handler
// ════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  // ── Validation ────────────────────────────────────────────
  let body: { user_id?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide.' }, { status: 400 })
  }

  const { user_id } = body
  if (typeof user_id !== 'string' || !user_id) {
    return NextResponse.json({ error: '`user_id` manquant.' }, { status: 400 })
  }

  // ── 1. Charger la collection de l'user avec join stickers_reference ──
  const { data: collection, error: collErr } = await supabaseAdmin
    .from('user_collection')
    .select('sticker_id, quantity, first_obtained_at, stickers_reference(country)')
    .eq('user_id', user_id)

  if (collErr) {
    console.error('[check-badges] user_collection:', collErr.message)
    return NextResponse.json({ error: 'Impossible de charger la collection.' }, { status: 500 })
  }

  const rows = (collection ?? []) as CollectionRow[]

  // ── 2. Calculer les stats ──────────────────────────────────

  // Cartes uniques
  const totalUnique = rows.length

  // Doublons : sum(quantity - 1) pour quantity > 1
  const totalDuplicates = rows.reduce(
    (sum, r) => sum + (r.quantity > 1 ? r.quantity - 1 : 0),
    0
  )

  // Pays distincts + joueurs par pays
  const countryMap = new Map<string, number>() // country → nb joueurs possédés
  for (const r of rows) {
    const country =
      (Array.isArray(r.stickers_reference)
        ? (r.stickers_reference[0] as { country: string } | undefined)?.country
        : r.stickers_reference?.country) ?? null
    if (!country) continue
    countryMap.set(country, (countryMap.get(country) ?? 0) + 1)
  }
  const countriesCount = countryMap.size

  // Sticker IDs possédés
  const ownedStickerIds = new Set(rows.map(r => r.sticker_id))

  // Cartes ajoutées dans les 10 dernières minutes
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const sessionCards = rows.filter(r => r.first_obtained_at >= tenMinutesAgo).length

  console.log(`[check-badges] user=${user_id} unique=${totalUnique} dupes=${totalDuplicates} countries=${countriesCount} session=${sessionCards}`)

  // ── 3. Charger les totaux par pays dans stickers_reference ──
  // Nécessaire pour full_country et full_continent
  const { data: allStickers } = await supabaseAdmin
    .from('stickers_reference')
    .select('sticker_id, country')

  // Total attendu par pays dans la référence
  const refCountryTotal = new Map<string, number>()
  for (const s of allStickers ?? []) {
    const c = s.country as string
    if (c) refCountryTotal.set(c, (refCountryTotal.get(c) ?? 0) + 1)
  }

  // ── 4. Charger tous les badges et ceux déjà obtenus ────────
  const [{ data: allBadges }, { data: earned }] = await Promise.all([
    supabaseAdmin.from('badges_reference').select('badge_id, name, description, condition_type, condition_value, points'),
    supabaseAdmin.from('user_badges').select('badge_id').eq('user_id', user_id),
  ])

  const earnedIds = new Set((earned ?? []).map(e => e.badge_id as string))

  // ── 5. Évaluer chaque badge non encore obtenu ──────────────

  // Nations européennes pour b09 (liste des pays UEFA présents dans stickers_reference)
  const europeanCountries = new Set(
    (allStickers ?? [])
      .map(s => s.country as string)
      .filter(c => EUROPEAN_NATIONS.has(c))
  )

  const newBadges: { badge_id: string; name: string; points: number }[] = []

  for (const badge of (allBadges ?? []) as BadgeRef[]) {
    if (earnedIds.has(badge.badge_id)) continue

    const unlocked = evaluateBadge(badge, {
      totalUnique,
      totalDuplicates,
      countriesCount,
      countryMap,
      refCountryTotal,
      ownedStickerIds,
      sessionCards,
      europeanCountries,
    })

    if (!unlocked) continue

    const { error: insertErr } = await supabaseAdmin
      .from('user_badges')
      .insert({ user_id, badge_id: badge.badge_id, obtained_at: new Date().toISOString() })

    if (insertErr) {
      console.error(`[check-badges] insert badge ${badge.badge_id}:`, insertErr.message)
    } else {
      console.log(`[check-badges] 🏅 nouveau badge : ${badge.badge_id} — ${badge.name}`)
      newBadges.push({ badge_id: badge.badge_id, name: badge.name, points: badge.points })
    }
  }

  return NextResponse.json({ new_badges: newBadges })
}

// ════════════════════════════════════════════════════════════
// Évaluation des conditions
// ════════════════════════════════════════════════════════════

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
      // Au moins un pays avec >= v joueurs possédés
      for (const count of stats.countryMap.values()) {
        if (count >= v) return true
      }
      return false

    case 'full_country':
      // Au moins un pays où tous les joueurs attendus sont possédés
      for (const [country, owned] of stats.countryMap.entries()) {
        const expected = stats.refCountryTotal.get(country) ?? 0
        if (expected > 0 && owned >= expected) return true
      }
      return false

    case 'specific_sticker':
      // b02 : posséder un sticker_id contenant 'MESSI'
      if (badge.badge_id === 'b02') {
        for (const id of stats.ownedStickerIds) {
          if (id.toUpperCase().includes('MESSI')) return true
        }
      }
      return false

    case 'session_cards':
      return stats.sessionCards >= v

    case 'full_continent':
      // b09 : toutes les nations européennes ont au moins 1 joueur
      if (badge.badge_id === 'b09') {
        for (const nation of stats.europeanCountries) {
          if (!stats.countryMap.has(nation)) return false
        }
        return stats.europeanCountries.size > 0
      }
      return false

    default:
      console.warn(`[check-badges] condition_type inconnu : ${badge.condition_type}`)
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
