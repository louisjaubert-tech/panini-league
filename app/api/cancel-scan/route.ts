import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(request: NextRequest) {
  let body: { pack_id?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide.' }, { status: 400 })
  }

  const { pack_id } = body

  if (typeof pack_id !== 'string' || !pack_id) {
    return NextResponse.json({ error: '`pack_id` manquant.' }, { status: 400 })
  }

  // Supprimer les stickers scannés pour ce pack
  const { error: scanErr } = await supabaseAdmin
    .from('scanned_stickers')
    .delete()
    .eq('pack_id', pack_id)

  if (scanErr) {
    console.error('[cancel-scan] scanned_stickers delete:', scanErr.message)
    return NextResponse.json({ error: 'Impossible de supprimer les stickers.' }, { status: 500 })
  }

  // Supprimer le pack lui-même (et sa photo dans Storage si besoin)
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
