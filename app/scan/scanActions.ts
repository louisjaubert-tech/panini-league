'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import type { PackRow } from './page'

const PAGE_SIZE = 20

type ScannedRow = {
  pack_id: string
  sticker_id: string
  confidence: number
  is_duplicate: boolean
  stickers_reference: { display_name: string } | { display_name: string }[] | null
}

export async function fetchMorePacks(userId: string, offset: number): Promise<PackRow[]> {
  const { data: packsRaw } = await supabaseAdmin
    .from('pack_openings')
    .select('id, opened_at, ocr_status, photo_url')
    .eq('user_id', userId)
    .order('opened_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (!packsRaw || packsRaw.length === 0) return []

  const packIds = packsRaw.map((p) => p.id as string)

  const { data: scannedRaw } = await supabaseAdmin
    .from('scanned_stickers')
    .select('pack_id, sticker_id, confidence, is_duplicate, stickers_reference(display_name)')
    .in('pack_id', packIds)
    .not('sticker_id', 'is', null)
    .gte('confidence', 0.85)

  const scannedByPack = new Map<string, { sticker_id: string; display_name: string | null; is_duplicate: boolean }[]>()
  for (const row of (scannedRaw ?? []) as ScannedRow[]) {
    const ref = Array.isArray(row.stickers_reference) ? row.stickers_reference[0] : row.stickers_reference
    if (!scannedByPack.has(row.pack_id)) scannedByPack.set(row.pack_id, [])
    scannedByPack.get(row.pack_id)!.push({
      sticker_id: row.sticker_id,
      display_name: ref?.display_name ?? null,
      is_duplicate: row.is_duplicate ?? false,
    })
  }

  // Trier les stickers de chaque pack par nom de famille
  for (const [packId, stickers] of scannedByPack.entries()) {
    scannedByPack.set(
      packId,
      [...stickers].sort((a, b) => {
        const last = (s: { display_name: string | null }) =>
          (s.display_name ?? '').split(' ').pop()?.toLowerCase() ?? ''
        return last(a).localeCompare(last(b), 'fr')
      }),
    )
  }

  return packsRaw.map((p) => ({
    id:         p.id as string,
    opened_at:  p.opened_at as string,
    ocr_status: p.ocr_status as string,
    photo_url:  (p.photo_url as string | null) ?? null,
    stickers:   scannedByPack.get(p.id as string) ?? [],
  }))
}
