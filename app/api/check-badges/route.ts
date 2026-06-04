import { NextRequest, NextResponse } from 'next/server'
import { checkBadges } from '@/lib/checkBadges'

export async function POST(request: NextRequest) {
  let body: { user_id?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide.' }, { status: 400 })
  }

  const { user_id } = body
  if (typeof user_id !== 'string' || !user_id) {
    return NextResponse.json({ error: '`user_id` manquant.' }, { status: 400 })
  }

  try {
    const result = await checkBadges(user_id)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
