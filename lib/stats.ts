import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const TOTAL_STICKERS = 960

export type UserStats = {
  unique:     number   // lignes dans user_collection
  duplicates: number   // sum(quantity - 1) pour quantity > 1
  countries:  number   // pays distincts possédés
  percentage: number   // unique / TOTAL_STICKERS * 100, arrondi à 1 décimale
  total:      number   // 960
}

export async function getUserStats(userId: string): Promise<UserStats> {
  const [uniqueResult, duplicatesResult, countriesResult] = await Promise.all([
    // Cartes uniques
    supabaseAdmin
      .from('user_collection')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId),

    // Doublons
    supabaseAdmin
      .from('user_collection')
      .select('quantity')
      .eq('user_id', userId)
      .gt('quantity', 1),

    // Pays distincts via join
    supabaseAdmin
      .from('user_collection')
      .select('stickers_reference!inner(country)')
      .eq('user_id', userId),
  ])

  const unique = uniqueResult.count ?? 0

  const duplicates =
    duplicatesResult.data?.reduce(
      (sum, row) => sum + ((row.quantity as number) - 1),
      0
    ) ?? 0

  const countriesSet = new Set<string>()
  for (const row of countriesResult.data ?? []) {
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
