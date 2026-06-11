import { cookies } from 'next/headers'
import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import CollectionClient, { type CountryData, type BadgeSectionData } from './CollectionClient'
import { getContinent } from '@/lib/continents'

/** Extrait le numéro de fin d'un sticker_id (ex: FRA20 → 20) */
function stickerNumber(id: string): number {
  const m = id.match(/(\d+)$/)
  return m ? parseInt(m[1], 10) : 0
}

// Pays à exclure du classement (stickers spéciaux)
const EXCLUDED_COUNTRIES = new Set(['Special', 'FIFA World Cup'])

export default async function CollectionPage() {
  // ── Auth (optionnelle) ────────────────────────────────────────
  const cookieStore = await cookies()
  const token = cookieStore.get('sb-access-token')?.value
  let userId: string | null = null

  if (token) {
    const { data: { user } } = await supabase.auth.getUser(token)
    if (user) userId = user.id
  }

  const isGuest = !userId

  // ── Fetch données ─────────────────────────────────────────────
  const [refResult, collectionResult] = await Promise.all([
    supabaseAdmin
      .from('stickers_reference')
      .select('sticker_id, display_name, country, category'),
    isGuest
      ? Promise.resolve({ data: [] })
      : supabaseAdmin
          .from('user_collection')
          .select('sticker_id, quantity')
          .eq('user_id', userId!),
  ])

  const allStickers = (refResult.data ?? []) as {
    sticker_id: string
    display_name: string
    country: string
    category: string
  }[]

  const collectionRows = (collectionResult.data ?? []) as { sticker_id: string; quantity: number }[]
  const ownedIds    = new Set(collectionRows.map((r) => r.sticker_id))
  const quantityMap = new Map(collectionRows.map((r) => [r.sticker_id, r.quantity]))

  // ── Séparer joueurs / emblèmes / team photos ───────────────────
  const emblems: { sticker_id: string; display_name: string; country: string; owned: boolean; quantity: number }[] = []
  const teamPhotos: { sticker_id: string; display_name: string; country: string; owned: boolean; quantity: number }[] = []

  const countryMap = new Map<
    string,
    { sticker_id: string; display_name: string; owned: boolean; quantity: number }[]
  >()

  for (const s of allStickers) {
    if (EXCLUDED_COUNTRIES.has(s.country)) continue

    const owned = ownedIds.has(s.sticker_id)
    const quantity = quantityMap.get(s.sticker_id) ?? 0
    const entry = { sticker_id: s.sticker_id, display_name: s.display_name, country: s.country, owned, quantity }

    if (s.category === 'badge') {
      if (s.display_name.toLowerCase().includes('team photo')) {
        teamPhotos.push(entry)
      } else {
        emblems.push(entry)
      }
    } else {
      // player (et autres)
      if (!countryMap.has(s.country)) countryMap.set(s.country, [])
      countryMap.get(s.country)!.push({ sticker_id: s.sticker_id, display_name: s.display_name, owned, quantity })
    }
  }

  // Trier emblèmes et team photos par pays alphabétique
  const sortByCountry = (a: { country: string }, b: { country: string }) =>
    a.country.localeCompare(b.country, 'fr')
  emblems.sort(sortByCountry)
  teamPhotos.sort(sortByCountry)

  // ── Construire le tableau de données pays (joueurs) ────────────
  const countries: CountryData[] = []

  for (const [country, stickers] of countryMap.entries()) {
    const ownedCount = stickers.filter((s) => s.owned).length
    const total = stickers.length
    const pct = total > 0 ? Math.round((ownedCount / total) * 100) : 0

    stickers.sort((a, b) => stickerNumber(a.sticker_id) - stickerNumber(b.sticker_id))

    countries.push({
      country,
      continent: getContinent(country),
      total,
      ownedCount,
      pct,
      stickers,
    })
  }

  countries.sort((a, b) => {
    if (b.pct !== a.pct) return b.pct - a.pct
    return a.country.localeCompare(b.country)
  })

  // ── Données sections badge ─────────────────────────────────────
  const emblemSection: BadgeSectionData = {
    title: '🛡️ Emblèmes des sélections',
    items: emblems,
    ownedCount: emblems.filter((s) => s.owned).length,
  }

  const teamPhotoSection: BadgeSectionData = {
    title: '📸 Photos d\'équipe',
    items: teamPhotos,
    ownedCount: teamPhotos.filter((s) => s.owned).length,
  }

  return (
    <main className="min-h-screen px-4 sm:px-6 lg:px-8 py-10" style={{ backgroundColor: '#0a1628' }}>
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-white">
            Ma <span style={{ color: '#ffd60a' }}>collection</span>
          </h1>
          <p className="mt-1 text-sm" style={{ color: '#64748b' }}>
            {countries.filter((c) => c.ownedCount > 0).length} pays représentés
            · {countries.length} pays au total
          </p>
        </div>

        <CollectionClient
          countries={countries}
          emblemSection={emblemSection}
          teamPhotoSection={teamPhotoSection}
          isGuest={isGuest}
        />
      </div>
    </main>
  )
}
