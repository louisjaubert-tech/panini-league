import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabase } from '@/lib/supabase'

export async function POST() {
  const cookieStore = await cookies()
  const refreshToken = cookieStore.get('sb-refresh-token')?.value

  if (!refreshToken) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken })

  if (error || !data.session) {
    // Refresh token invalide ou expiré — on nettoie les cookies
    cookieStore.delete('sb-access-token')
    cookieStore.delete('sb-refresh-token')
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const isProduction = process.env.NODE_ENV === 'production'

  cookieStore.set('sb-access-token', data.session.access_token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: data.session.expires_in,
    path: '/',
  })

  // Renouveler aussi le refresh_token (Supabase peut en émettre un nouveau)
  cookieStore.set('sb-refresh-token', data.session.refresh_token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 jours
    path: '/',
  })

  return NextResponse.json({ ok: true })
}
