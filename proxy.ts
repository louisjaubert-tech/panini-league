import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const token =
    request.cookies.get('sb-access-token') ??
    request.cookies.get('sb-umuozbsigejfpvijzvly-auth-token')

  const { pathname } = request.nextUrl

  const protectedPaths = ['/dashboard', '/scan']
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
