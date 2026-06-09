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

  console.log(`[confirm-scan] ── DÉBUT ── pack_id=${pack_id} user_id=${user_id}`)

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

  console.log(`[confirm-scan] scanned_stickers: ${(scannedRows ?? []).length} ligne(s) récupérée(s) pour ce pack`)

  // Tous les stickers avec sticker_id non null (le seuil de qualité est déjà appliqué dans matchSticker.ts)
  const matchedRows = (scannedRows ?? []).filter((r) => r.sticker_id)

  console.log(`[confirm-scan] stickers retenus (sticker_id non null) : ${matchedRows.length}`)
  matchedRows.forEach((r, i) => {
    console.log(`[confirm-scan]   [${i + 1}/${matchedRows.length}] sticker_id=${r.sticker_id} confidence=${r.confidence}`)
  })

  // ── 2. Récupérer la collection actuelle pour calculer is_duplicate ─
  const { data: currentCollection } = await supabaseAdmin
    .from('user_collection')
    .select('id, sticker_id, quantity')
    .eq('user_id', user_id)

  console.log(`[confirm-scan] user_collection actuelle : ${(currentCollection ?? []).length} sticker(s) déjà possédé(s)`)

  const collectionMap = new Map(
    (currentCollection ?? []).map((row) => [
      row.sticker_id as string,
      { id: row.id as string, quantity: row.quantity as number },
    ]),
  )

  // ── 3. Écrire dans user_collection ────────────────────────
  let upsertCount = 0

  for (const row of matchedRows) {
    const sticker_id = row.sticker_id as string
    const existing = collectionMap.get(sticker_id)

    if (existing) {
      const newQty = existing.quantity + 1
      const { error: updateErr } = await supabaseAdmin
        .from('user_collection')
        .update({ quantity: newQty })
        .eq('id', existing.id)

      if (updateErr) {
        console.error(`[confirm-scan] update user_collection ÉCHEC sticker_id=${sticker_id} id=${existing.id} :`, updateErr.message)
      } else {
        console.log(`[confirm-scan] update OK sticker_id=${sticker_id} quantity ${existing.quantity} → ${newQty} (doublon)`)
        upsertCount++
      }
      // Mettre à jour le map pour les doublons du même pack
      collectionMap.set(sticker_id, { id: existing.id, quantity: newQty })
    } else {
      const { error: insertErr } = await supabaseAdmin
        .from('user_collection')
        .insert({ user_id, sticker_id, quantity: 1, first_obtained_at: new Date().toISOString() })

      if (insertErr) {
        console.error(`[confirm-scan] insert user_collection ÉCHEC sticker_id=${sticker_id} :`, insertErr.message)
      } else {
        console.log(`[confirm-scan] insert OK sticker_id=${sticker_id} (nouveau)`)
        upsertCount++
      }
      collectionMap.set(sticker_id, { id: '', quantity: 1 })
    }
  }

  console.log(`[confirm-scan] user_collection : ${upsertCount}/${matchedRows.length} ligne(s) mises à jour avec succès`)

  // ── 4. Mettre à jour ocr_status = 'done' ──────────────────
  await supabaseAdmin
    .from('pack_openings')
    .update({ ocr_status: 'done' })
    .eq('id', pack_id)

  console.log(`[confirm-scan] pack_openings ocr_status → 'done' pour pack_id=${pack_id}`)

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

  return NextResponse.json({ success: true, stickers_added: upsertCount, new_badges, new_trophies })
}
