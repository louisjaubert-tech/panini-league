import { supabaseAdmin } from '@/lib/supabaseAdmin'

/** Nombre réel de stickers réguliers dans l'album (joueurs + emblèmes + team photos,
 *  hors stickers spéciaux CC-LAM*, LY, KM…) */
export const TOTAL_STICKERS = 979

/** Retourne true pour les stickers d'équipe standard (ESP15, FRA8, emblèmes inclus) */
function isRegularStickerId(id: string): boolean {
  return /^[A-Z]{2,5}\d+$/.test(id)
}

export type UserStats = {
  unique:     number   // lignes dans user_collection
  duplicates: number   // sum(quantity - 1) pour quantity > 1
  countries:  number   // pays distincts possédés
  percentage: number   // unique / TOTAL_STICKERS * 100, arrondi à 1 décimale
  total:      number   // 960
}

export async function getUserStats(userId: string): Promise<UserStats> {
  // On charge tous les stickers avec leur quantité et pays, puis on filtre côté code
  const { data: allRows } = await supabaseAdmin
    .from('user_collection')
    .select('sticker_id, quantity, stickers_reference!inner(country)')
    .eq('user_id', userId)

  // Garder uniquement les stickers réguliers (exclure CC-LAM*, LY, KM…)
  type CollRow = { sticker_id: string; quantity: number; stickers_reference: { country: string } | { country: string }[] | null }
  const rows = ((allRows ?? []) as CollRow[]).filter((r) => isRegularStickerId(r.sticker_id))

  const unique = rows.length

  const duplicates = rows.reduce(
    (sum, row) => sum + (row.quantity > 1 ? row.quantity - 1 : 0),
    0
  )

  const countriesSet = new Set<string>()
  for (const row of rows) {
    const raw = row.stickers_reference
    const ref = (Array.isArray(raw) ? raw[0] : raw) as { country: string } | null
    if (ref?.country) countriesSet.add(ref.country)
  }

  const percentage = parseFloat(((unique / TOTAL_STICKERS) * 100).toFixed(1))

  return {
    unique,
    duplicates,
    countries: countriesSet.size,
    percentage,
    total: TOTAL_STICKERS,
  }
}
