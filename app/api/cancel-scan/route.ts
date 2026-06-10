import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { decrementSticker } from '@/lib/collection'

export async function POST(request: NextRequest) {
  let body: { pack_id?: unknown; user_id?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide.' }, { status: 400 })
  }

  const { pack_id, user_id } = body

  if (typeof pack_id !== 'string' || !pack_id) {
    return NextResponse.json({ error: '`pack_id` manquant.' }, { status: 400 })
  }

  // ── Flux "retrait post-confirmation" (user_id fourni) ─────────────────────
  if (typeof user_id === 'string' && user_id) {
    console.log(`[cancel-scan] retrait post-confirmation pack_id=${pack_id} user_id=${user_id}`)

    // 1. Récupérer les stickers confirmés pour ce pack
    const { data: scannedRows, error: scanErr } = await supabaseAdmin
      .from('scanned_stickers')
      .select('sticker_id')
      .eq('pack_id', pack_id)
      .not('sticker_id', 'is', null)

    if (scanErr) {
      console.error('[cancel-scan] scanned_stickers fetch:', scanErr.message)
      return NextResponse.json({ error: 'Impossible de lire les stickers scannés.' }, { status: 500 })
    }

    // 2. Décrémenter chaque sticker de la collection
    let removed = 0
    for (const row of scannedRows ?? []) {
      const ok = await decrementSticker(supabaseAdmin, user_id, row.sticker_id as string)
      if (ok) removed++
    }

    console.log(`[cancel-scan] ${removed}/${(scannedRows ?? []).length} sticker(s) retirés de la collection`)

    // 3. Marquer le pack comme annulé
    await supabaseAdmin
      .from('pack_openings')
      .update({ ocr_status: 'cancelled' })
      .eq('id', pack_id)

    console.log(`[cancel-scan] pack_openings ocr_status → 'cancelled' pour pack_id=${pack_id}`)

    return NextResponse.json({ success: true, removed })
  }

  // ── Flux "annulation pré-confirmation" (ancien comportement) ─────────────
  const { error: scanErr } = await supabaseAdmin
    .from('scanned_stickers')
    .delete()
    .eq('pack_id', pack_id)

  if (scanErr) {
    console.error('[cancel-scan] scanned_stickers delete:', scanErr.message)
    return NextResponse.json({ error: 'Impossible de supprimer les stickers.' }, { status: 500 })
  }

  const { error: packErr } = await supabaseAdmin
    .from('pack_openings')
    .delete()
    .eq('id', pack_id)

  if (packErr) {
    console.error('[cancel-scan] pack_openings delete:', packErr.message)
    return NextResponse.json({ error: 'Impossible de supprimer le scan.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
