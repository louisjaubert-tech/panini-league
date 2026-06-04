import { NextRequest, NextResponse } from 'next/server'
import { matchStickers } from '@/lib/matchSticker'

export async function POST(request: NextRequest) {
  let body: { blocs?: unknown; user_id?: unknown; pack_id?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide.' }, { status: 400 })
  }

  const { blocs, user_id, pack_id } = body

  if (!Array.isArray(blocs) || blocs.length === 0) {
    return NextResponse.json({ error: '`blocs` doit être un tableau non vide de strings.' }, { status: 400 })
  }
  if (typeof user_id !== 'string' || !user_id) {
    return NextResponse.json({ error: '`user_id` manquant.' }, { status: 400 })
  }
  if (typeof pack_id !== 'string' || !pack_id) {
    return NextResponse.json({ error: '`pack_id` manquant.' }, { status: 400 })
  }
  if (blocs.some(b => typeof b !== 'string')) {
    return NextResponse.json({ error: 'Tous les éléments de `blocs` doivent être des strings.' }, { status: 400 })
  }

  try {
    const results = await matchStickers(blocs as string[], user_id, pack_id)
    return NextResponse.json(results)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
