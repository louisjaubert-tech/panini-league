import Link from 'next/link'
import { cookies } from 'next/headers'

export default async function PublicHeader() {
  const cookieStore = await cookies()
  const isLoggedIn = !!cookieStore.get('sb-access-token')

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="text-lg font-bold text-indigo-600">
            Panini League
          </Link>
          <nav className="flex items-center gap-3">
            <Link
              href="/leaderboard"
              className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors"
            >
              Classement
            </Link>
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
              >
                Mon espace
              </Link>
            ) : (
              <Link
                href="/login"
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
              >
                Connexion
              </Link>
            )}
          </nav>
        </div>
      </div>
    </header>
  )
}
