'use client'

import { useActionState, useRef, useState } from 'react'
import Link from 'next/link'
import { login } from '@/app/actions/auth'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, {})
  const emailRef = useRef<HTMLInputElement>(null)
  const [resetStatus, setResetStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')
  const [resetMsg, setResetMsg] = useState('')

  async function handleResetPassword() {
    const email = emailRef.current?.value.trim()
    if (!email) {
      setResetStatus('error')
      setResetMsg('Entrez votre email d\'abord.')
      return
    }
    setResetStatus('loading')
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) {
      setResetStatus('error')
      setResetMsg(error.message)
    } else {
      setResetStatus('sent')
      setResetMsg('Un email de réinitialisation a été envoyé.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a1628] px-4">
      <div className="w-full max-w-md">
        <div className="bg-white/5 rounded-2xl border border-white/10 p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">Connexion</h1>
            <p className="mt-1 text-sm text-gray-400">
              Pas encore de compte ?{' '}
              <Link href="/register" className="text-red-400 hover:text-red-300 font-medium">
                S&apos;inscrire
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
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                Email
              </label>
              <input
                ref={emailRef}
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
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                  Mot de passe
                </label>
                <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={resetStatus === 'loading'}
                  className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
                >
                  {resetStatus === 'loading' ? 'Envoi…' : 'Mot de passe oublié ?'}
                </button>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full rounded-lg border border-white/15 px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 bg-white/5"
                placeholder="••••••••"
              />
              {resetStatus === 'sent' && (
                <p className="mt-1.5 text-xs text-green-600">{resetMsg}</p>
              )}
              {resetStatus === 'error' && (
                <p className="mt-1.5 text-xs text-red-600">{resetMsg}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {pending ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
