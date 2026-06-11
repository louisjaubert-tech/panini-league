import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/** Tente de rafraîchir la session via le refresh_token Supabase.
 *  Retourne { access_token, refresh_token, expires_in } ou null. */
async function refreshSession(refreshToken: string) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      },
    )
    if (!res.ok) return null
    const data = await res.json()
    if (!data.access_token) return null
    return data as { access_token: string; refresh_token: string; expires_in: number }
  } catch {
    return null
  }
}

export async function proxy(request: NextRequest) {
  const accessToken =
    request.cookies.get('sb-access-token')?.value ??
    request.cookies.get('sb-umuozbsigejfpvijzvly-auth-token')?.value

  const refreshToken = request.cookies.get('sb-refresh-token')?.value

  const { pathname } = request.nextUrl
  const isProduction = process.env.NODE_ENV === 'production'

  // ── Refresh automatique si access_token absent mais refresh_token présent ──
  if (!accessToken && refreshToken) {
    const newSession = await refreshSession(refreshToken)

    if (newSession) {
      // On laisse passer la requête ET on injecte les nouveaux cookies
      const response = NextResponse.next()

      response.cookies.set('sb-access-token', newSession.access_token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: newSession.expires_in,
        path: '/',
      })
      response.cookies.set('sb-refresh-token', newSession.refresh_token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 jours
        path: '/',
      })

      // Si c'est une page protégée, on la laisse passer avec le nouveau token
      return response
    }

    // Refresh échoué → traiter comme non connecté
    const protectedPaths = ['/dashboard']
    if (protectedPaths.some((p) => pathname.startsWith(p))) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return NextResponse.next()
  }

  // ── Logique standard (access_token présent ou absent sans refresh) ──
  const token = accessToken

  const protectedPaths = ['/dashboard']
  if (!token && protectedPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (token && (pathname === '/login' || pathname === '/register')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/scan/:path*', '/login', '/register'],
}
