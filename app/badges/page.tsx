import Link from 'next/link'
import { cookies } from 'next/headers'
import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import BadgesClient, { type BadgeWithProgress } from './BadgesClient'

export const metadata = {
  title: 'Badges — Panini Club',
  description: 'Badges à débloquer en scannant tes stickers',
}

// ── Nations européennes (même liste que checkBadges.ts) ──────────────────────

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

function computeProgress(
  badge: { badge_id: string; condition_type: string; condition_value: number },
  stats: {
    totalUnique: number
    totalDuplicates: number
    countryMap: Map<string, number>
    refCountryTotal: Map<string, number>
    ownedStickerIds: Set<string>
    europeanCountriesInRef: Set<string>
  },
): number {
  const v = badge.condition_value
  switch (badge.condition_type) {
    case 'total_cards':
    case 'unique_cards':
      return Math.min(100, Math.round((stats.totalUnique / v) * 100))
    case 'duplicates':
      return Math.min(100, Math.round((stats.totalDuplicates / v) * 100))
    case 'countries_count':
      return Math.min(100, Math.round((stats.countryMap.size / v) * 100))
    case 'same_country': {
      const maxOwned = Math.max(0, ...stats.countryMap.values())
      return Math.min(100, Math.round((maxOwned / v) * 100))
    }
    case 'full_country': {
      let maxPct = 0
      for (const [country, owned] of stats.countryMap.entries()) {
        const total = stats.refCountryTotal.get(country) ?? 0
        if (total > 0) maxPct = Math.max(maxPct, owned / total)
      }
      return Math.min(100, Math.round(maxPct * 100))
    }
    case 'specific_sticker': {
      if (badge.badge_id === 'b02') {
        return stats.ownedStickerIds.has('ARG17') && stats.ownedStickerIds.has('POR15') ? 100 : 0
      }
      return 0
    }
    case 'full_continent': {
      if (badge.badge_id === 'b09') {
        const total = stats.europeanCountriesInRef.size
        if (total === 0) return 0
        const owned = [...stats.europeanCountriesInRef].filter((c) => stats.countryMap.has(c)).length
        return Math.min(100, Math.round((owned / total) * 100))
      }
      return 0
    }
    default:
      return 0
  }
}

export default async function BadgesPage() {
  // ── Auth (optionnelle) ────────────────────────────────────────
  const cookieStore = await cookies()
  const token = cookieStore.get('sb-access-token')?.value
  let userId: string | null = null

  if (token) {
    const { data: { user } } = await supabase.auth.getUser(token)
    if (user) userId = user.id
  }

  const isGuest = !userId

  // ── Fetch tous les badges ─────────────────────────────────────
  const { data: badgesRaw } = await supabaseAdmin
    .from('badges_reference')
    .select('badge_id, name, description, condition_type, condition_value, points')
    .order('points', { ascending: true })

  let badges: BadgeWithProgress[]

  if (isGuest) {
    // Invité : tout à 0%
    badges = (badgesRaw ?? []).map((b) => ({
      badge_id:        b.badge_id as string,
      name:            b.name as string,
      description:     b.description as string,
      condition_type:  b.condition_type as string,
      condition_value: b.condition_value as number,
      points:          b.points as number,
      earned:          false,
      progress:        0,
      obtained_at:     null,
    }))
  } else {
    // Utilisateur connecté : calcul réel
    const [earnedResult, collectionResult, refResult] = await Promise.all([
      supabaseAdmin.from('user_badges').select('badge_id, obtained_at').eq('user_id', userId!),
      supabaseAdmin.from('user_collection').select('sticker_id, quantity, stickers_reference(country)').eq('user_id', userId!),
      supabaseAdmin.from('stickers_reference').select('sticker_id, country'),
    ])

    type CollRow = { sticker_id: string; quantity: number; stickers_reference: { country: string } | { country: string }[] | null }
    const collRows = (collectionResult.data ?? []) as CollRow[]
    const totalUnique = collRows.length
    const totalDuplicates = collRows.reduce((s, r) => s + (r.quantity > 1 ? r.quantity - 1 : 0), 0)
    const countryMap = new Map<string, number>()
    const ownedStickerIds = new Set<string>()

    for (const r of collRows) {
      ownedStickerIds.add(r.sticker_id)
      const country = (Array.isArray(r.stickers_reference)
        ? (r.stickers_reference[0] as { country: string } | undefined)?.country
        : r.stickers_reference?.country) ?? null
      if (country) countryMap.set(country, (countryMap.get(country) ?? 0) + 1)
    }

    const refCountryTotal = new Map<string, number>()
    for (const s of refResult.data ?? []) {
      const c = s.country as string
      if (c) refCountryTotal.set(c, (refCountryTotal.get(c) ?? 0) + 1)
    }

    const europeanCountriesInRef = new Set(
      (refResult.data ?? []).map((s) => s.country as string).filter((c) => EUROPEAN_NATIONS.has(c))
    )

    const stats = { totalUnique, totalDuplicates, countryMap, refCountryTotal, ownedStickerIds, europeanCountriesInRef }
    const earnedIds = new Set((earnedResult.data ?? []).map((e) => e.badge_id as string))
    const earnedAt  = new Map((earnedResult.data ?? []).map((e) => [e.badge_id as string, e.obtained_at as string]))

    badges = (badgesRaw ?? []).map((badge) => {
      const earned = earnedIds.has(badge.badge_id as string)
      return {
        badge_id:        badge.badge_id as string,
        name:            badge.name as string,
        description:     badge.description as string,
        condition_type:  badge.condition_type as string,
        condition_value: badge.condition_value as number,
        points:          badge.points as number,
        earned,
        progress: earned ? 100 : computeProgress(badge as { badge_id: string; condition_type: string; condition_value: number }, stats),
        obtained_at: earnedAt.get(badge.badge_id as string) ?? null,
      }
    })
  }

  return (
    <main className="min-h-screen bg-[#0a1628] px-4 sm:px-6 lg:px-8 py-10">
      <div className="mx-auto max-w-3xl">

        {/* Bannière invité */}
        {isGuest && (
          <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-orange-500/30 bg-orange-500/10 px-5 py-4">
            <p className="text-sm text-orange-200">
              🏅 Débloque ces badges en scannant tes stickers et en complétant ta collection !
            </p>
            <Link
              href="/register"
              className="shrink-0 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#f97316' }}
            >
              S&apos;inscrire
            </Link>
          </div>
        )}

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Badges</h1>
          <p className="mt-1 text-sm text-gray-400">
            {badges.filter((b) => b.earned).length}/{badges.length} badges débloqués
          </p>
        </div>

        <BadgesClient badges={badges} />
      </div>
    </main>
  )
}
