import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { checkBadges, checkLeagueTrophies, type NewTrophy, type NewBadge } from '@/lib/checkBadges'

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
  if (typeof user_id !== 'string' || !user_id) {
    return NextResponse.json({ error: '`user_id` manquant.' }, { status: 400 })
  }

  // ── 1. Récupérer les stickers reconnus pour ce pack ────────
  const { data: scannedRows, error: scanErr } = await supabaseAdmin
    .from('scanned_stickers')
    .select('sticker_id, confidence, is_duplicate')
    .eq('pack_id', pack_id)
    .not('sticker_id', 'is', null)

  if (scanErr) {
    console.error('[confirm-scan] scanned_stickers:', scanErr.message)
    return NextResponse.json({ error: 'Impossible de lire les stickers scannés.' }, { status: 500 })
  }

  // Uniquement les stickers avec confidence >= 0.85 (matched)
  const matchedRows = (scannedRows ?? []).filter(
    (r) => (r.confidence as number) >= 0.85 && r.sticker_id,
  )

  // ── 2. Récupérer la collection actuelle pour calculer is_duplicate ─
  const { data: currentCollection } = await supabaseAdmin
    .from('user_collection')
    .select('id, sticker_id, quantity')
    .eq('user_id', user_id)

  const collectionMap = new Map(
    (currentCollection ?? []).map((row) => [
      row.sticker_id as string,
      { id: row.id as string, quantity: row.quantity as number },
    ]),
  )

  // ── 3. Écrire dans user_collection ────────────────────────
  for (const row of matchedRows) {
    const sticker_id = row.sticker_id as string
    const existing = collectionMap.get(sticker_id)

    if (existing) {
      await supabaseAdmin
        .from('user_collection')
        .update({ quantity: existing.quantity + 1 })
        .eq('id', existing.id)
      // Mettre à jour le map pour les doublons du même pack
      collectionMap.set(sticker_id, { id: existing.id, quantity: existing.quantity + 1 })
    } else {
      await supabaseAdmin
        .from('user_collection')
        .insert({ user_id, sticker_id, quantity: 1, first_obtained_at: new Date().toISOString() })
      collectionMap.set(sticker_id, { id: '', quantity: 1 })
    }
  }

  // ── 4. Mettre à jour ocr_status = 'done' ──────────────────
  await supabaseAdmin
    .from('pack_openings')
    .update({ ocr_status: 'done' })
    .eq('id', pack_id)

  // ── 5. Vérifier badges ────────────────────────────────────
  let new_badges: NewBadge[] = []
  try {
    const result = await checkBadges(user_id)
    new_badges = result.new_badges
  } catch (err) {
    console.error('[confirm-scan] checkBadges:', err instanceof Error ? err.message : err)
  }

  // ── 6. Vérifier trophées de ligue ─────────────────────────
  let new_trophies: NewTrophy[] = []
  try {
    const { data: memberships } = await supabaseAdmin
      .from('league_members')
      .select('league_id')
      .eq('user_id', user_id)

    const leagueIds = (memberships ?? []).map((m) => m.league_id as string)

    const trophyResults = await Promise.all(
      leagueIds.map((leagueId) => checkLeagueTrophies(user_id, leagueId)),
    )
    new_trophies = trophyResults.flat()
  } catch (err) {
    console.error('[confirm-scan] checkLeagueTrophies:', err instanceof Error ? err.message : err)
  }

  return NextResponse.json({ success: true, new_badges, new_trophies })
}
