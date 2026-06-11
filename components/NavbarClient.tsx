'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/actions/auth'

const NAV_GROUP1 = [
  { href: '/dashboard',  label: '📊 Mes stats'     },
  { href: '/collection', label: '🃏 Ma collection' },
]

const NAV_GROUP2 = [
  { href: '/leagues',     label: '👥 Ligues'      },
  { href: '/echanges',    label: '🔄 Échanges'   },
  { href: '/leaderboard', label: '🏆 Classement'  },
]

const MOBILE_LINKS = [
  { href: '/scan',        label: '📷 ScanPhoto'    },
  { href: '/dashboard',   label: '📊 Mes stats'    },
  { href: '/collection',  label: '🃏 Ma collection' },
  { href: '/leagues',     label: '👥 Ligues'        },
  { href: '/echanges',    label: '🔄 Échanges'     },
  { href: '/leaderboard', label: '🏆 Classement'   },
]

export default function NavbarClient({
  isLoggedIn,
  username,
}: {
  isLoggedIn: boolean
  username: string
}) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  // Fermer le dropdown en cliquant ailleurs
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Rafraîchir silencieusement le token à chaque visite de page
  useEffect(() => {
    fetch('/api/refresh-session', { method: 'POST' }).catch(() => {/* silencieux */})
  }, [pathname])

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a1628]/95 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center gap-4">

          {/* ── Gauche : Logo + ScanPhoto ── */}
          <div className="flex shrink-0 items-center gap-8">
            <Link href="/">
              <Image
                src="/paninilogosansfond.png"
                alt="Panini Club"
                width={40}
                height={40}
                className="object-contain"
                priority
              />
            </Link>
            <Link
              href="/scan"
              className={`hidden sm:block rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                isActive('/scan')
                  ? 'bg-orange-500 text-white'
                  : 'bg-orange-500/20 text-orange-300 hover:bg-orange-500/40 hover:text-white'
              }`}
            >
              📷 ScanPhoto
            </Link>
          </div>

          {/* ── Centre : liens navigation ── */}
          <nav className="hidden md:flex flex-1 items-center justify-center gap-1">
            {NAV_GROUP1.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive(href)
                    ? 'bg-white/15 text-white'
                    : 'text-gray-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                {label}
              </Link>
            ))}
            <span className="mx-2 select-none text-white/20">|</span>
            {NAV_GROUP2.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive(href)
                    ? 'bg-white/15 text-white'
                    : 'text-gray-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* ── Droite : profil dropdown ou login ── */}
          <div className="ml-auto flex shrink-0 items-center gap-3">
            {isLoggedIn ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setDropdownOpen((o) => !o)}
                  className="hidden md:flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <span>{username}</span>
                  <svg
                    className={`h-3.5 w-3.5 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 top-full mt-1 w-40 rounded-xl border border-white/10 bg-[#0a1628] shadow-xl">
                    <form action={logout}>
                      <button
                        type="submit"
                        className="w-full rounded-xl px-4 py-2.5 text-left text-sm text-red-400 hover:bg-white/5 hover:text-red-300 transition-colors"
                      >
                        Déconnexion
                      </button>
                    </form>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-2">
                <Link
                  href="/login"
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
                >
                  Connexion
                </Link>
                <Link
                  href="/register"
                  className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: '#f97316' }}
                >
                  S&apos;inscrire
                </Link>
              </div>
            )}

            {/* ── Hamburger mobile ── */}
            <button
              type="button"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              className="inline-flex md:hidden items-center justify-center rounded-lg p-2 text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
            >
              {mobileOpen ? (
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
      </div>

      {/* ── Menu mobile ── */}
      {mobileOpen && (
        <div className="border-t border-white/10 bg-[#0a1628] md:hidden">
          <nav className="flex flex-col px-4 py-3 gap-1">
            {MOBILE_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive(href)
                    ? 'bg-white/15 text-white'
                    : 'text-gray-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="border-t border-white/10 px-4 py-3">
            {isLoggedIn ? (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-300">{username}</span>
                <form action={logout}>
                  <button
                    type="submit"
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-400 hover:text-red-300 transition-colors"
                  >
                    Déconnexion
                  </button>
                </form>
              </div>
            ) : (
              <div className="flex gap-3">
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="flex-1 rounded-lg border border-white/20 px-3 py-2 text-center text-sm font-medium text-gray-300 hover:bg-white/10 transition-colors"
                >
                  Connexion
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMobileOpen(false)}
                  className="flex-1 rounded-lg px-3 py-2 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: '#f97316' }}
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
