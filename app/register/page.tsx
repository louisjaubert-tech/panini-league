'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { register } from '@/app/actions/auth'

export default function RegisterPage() {
  const [state, action, pending] = useActionState(register, {})

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a1628] px-4">
      <div className="w-full max-w-md">
        <div className="bg-white/5 rounded-2xl border border-white/10 p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">Créer un compte</h1>
            <p className="mt-1 text-sm text-gray-400">
              Déjà inscrit ?{' '}
              <Link href="/login" className="text-red-400 hover:text-red-300 font-medium">
                Se connecter
              </Link>
            </p>
          </div>

          <form action={action} className="space-y-5">
            {state.error && (
              <div className="rounded-lg bg-red-900/40 border border-red-700/50 px-4 py-3 text-sm text-red-300">
                {state.error}
              </div>
            )}

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-1">
                Nom d&apos;utilisateur
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                className="w-full rounded-lg border border-white/15 px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 bg-white/5"
                placeholder="monpseudo"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full rounded-lg border border-white/15 px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 bg-white/5"
                placeholder="toi@exemple.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                Mot de passe
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                className="w-full rounded-lg border border-white/15 px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 bg-white/5"
                placeholder="••••••••"
              />
              <p className="mt-1 text-xs text-gray-400">Minimum 6 caractères</p>
            </div>

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {pending ? 'Inscription…' : 'Créer mon compte'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
