'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/actions/auth'

const NAV_LINKS = [
  { href: '/dashboard',   label: 'Mes stats',    separator: false },
  { href: '/collection',  label: 'Ma collection', separator: false },
  { href: '/scan',        label: '📷 ScanPhoto',  separator: true  },
  { href: '/leagues',     label: 'Ligues',        separator: false },
  { href: '/leaderboard', label: 'Classement',    separator: false },
]

export default function NavbarClient({
  isLoggedIn,
  username,
}: {
  isLoggedIn: boolean
  username: string
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a1628]/95 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-6">

          {/* ── Logo ── */}
          <Link href="/" className="shrink-0">
            <Image
              src="/logo_panini_club.png"
              alt="Panini Club"
              width={40}
              height={40}
              className="rounded-full object-contain"
              priority
            />
          </Link>

          {/* ── Nav desktop ── */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ href, label, separator }) => (
              <span key={href} className="flex items-center gap-1">
                {separator && (
                  <span className="mx-1 h-4 w-px bg-white/20" aria-hidden="true" />
                )}
                <Link
                  href={href}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive(href)
                      ? 'bg-white/15 text-white'
                      : 'text-gray-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {label}
                </Link>
              </span>
            ))}
          </nav>

          {/* ── Auth desktop ── */}
          <div className="hidden md:flex items-center gap-3">
            {isLoggedIn ? (
              <>
                <span className="text-sm font-medium text-gray-700">{username}</span>
                <form action={logout}>
                  <button
                    type="submit"
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Déconnexion
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Connexion
                </Link>
                <Link
                  href="/register"
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
                >
                  S&apos;inscrire
                </Link>
              </>
            )}
          </div>

          {/* ── Hamburger mobile ── */}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={open}
            className="inline-flex md:hidden items-center justify-center rounded-lg p-2 text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            {open ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* ── Menu mobile ── */}
      {open && (
        <div className="border-t border-white/10 bg-[#0a1628] md:hidden">
          <nav className="flex flex-col px-4 py-3 gap-1">
            {NAV_LINKS.map(({ href, label, separator }) => (
              <span key={href}>
                {separator && <div className="my-1 h-px bg-white/10" />}
                <Link
                  href={href}
                  onClick={() => setOpen(false)}
                  className={`block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive(href)
                      ? 'bg-white/15 text-white'
                      : 'text-gray-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {label}
                </Link>
              </span>
            ))}
          </nav>
          <div className="border-t border-white/10 px-4 py-3">
            {isLoggedIn ? (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-300">{username}</span>
                <form action={logout}>
                  <button
                    type="submit"
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Déconnexion
                  </button>
                </form>
              </div>
            ) : (
              <div className="flex gap-3">
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Connexion
                </Link>
                <Link
                  href="/register"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
                >
                  S&apos;inscrire
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
