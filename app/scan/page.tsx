import { cookies } from 'next/headers'
import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import ScanClient from './ScanClient'
import RecentScansClient from './RecentScansClient'

// ── Types ─────────────────────────────────────────────────────────────────────

export type PackSticker = {
  sticker_id: string
  display_name: string | null
  is_duplicate: boolean
}

export type PackRow = {
  id: string
  opened_at: string
  ocr_status: string
  photo_url: string | null
  stickers: PackSticker[]
}

// ── Page (Server Component) ───────────────────────────────────────────────────

export default async function ScanPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('sb-access-token')?.value
  let userId: string | null = null

  if (token) {
    const { data: { user } } = await supabase.auth.getUser(token)
    if (user) userId = user.id
  }

  const isGuest = !userId

  // Fetch 10 derniers scans (uniquement si connecté)
  const { data: packsRaw } = isGuest
    ? { data: [] }
    : await supabaseAdmin
        .from('pack_openings')
        .select('id, opened_at, ocr_status, photo_url')
        .eq('user_id', userId!)
        .order('opened_at', { ascending: false })
        .limit(10)

  const packIds = (packsRaw ?? []).map((p) => p.id as string)

  // Fetch stickers reconnus pour ces packs (avec display_name via join)
  type ScannedRow = {
    pack_id: string
    sticker_id: string
    confidence: number
    is_duplicate: boolean
    stickers_reference: { display_name: string } | { display_name: string }[] | null
  }

  let scannedByPack = new Map<string, PackSticker[]>()

  if (packIds.length > 0) {
    const { data: scannedRaw } = await supabaseAdmin
      .from('scanned_stickers')
      .select('pack_id, sticker_id, confidence, is_duplicate, stickers_reference(display_name)')
      .in('pack_id', packIds)
      .not('sticker_id', 'is', null)
      .gte('confidence', 0.85)

    for (const row of (scannedRaw ?? []) as ScannedRow[]) {
      const ref = Array.isArray(row.stickers_reference)
        ? row.stickers_reference[0]
        : row.stickers_reference
      const display_name = ref?.display_name ?? null

      const sticker: PackSticker = {
        sticker_id: row.sticker_id,
        display_name,
        is_duplicate: row.is_duplicate ?? false,
      }

      if (!scannedByPack.has(row.pack_id)) scannedByPack.set(row.pack_id, [])
      scannedByPack.get(row.pack_id)!.push(sticker)
    }
  }

  // Trier les stickers de chaque pack par nom de famille
  for (const [packId, stickers] of scannedByPack.entries()) {
    scannedByPack.set(
      packId,
      [...stickers].sort((a, b) => {
        const last = (s: PackSticker) =>
          (s.display_name ?? '').split(' ').pop()?.toLowerCase() ?? ''
        return last(a).localeCompare(last(b), 'fr')
      }),
    )
  }

  const packs: PackRow[] = (packsRaw ?? []).map((p) => ({
    id:         p.id as string,
    opened_at:  p.opened_at as string,
    ocr_status: p.ocr_status as string,
    photo_url:  (p.photo_url as string | null) ?? null,
    stickers:   scannedByPack.get(p.id as string) ?? [],
  }))

  return (
    <main className="min-h-screen bg-[#0a1628] px-4 sm:px-6 py-12">
      <div className="mx-auto max-w-lg">
        <ScanClient isGuest={isGuest} />
        {!isGuest && <RecentScansClient packs={packs} userId={userId!} />}
      </div>
    </main>
  )
}
