'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const router = useRouter()

  const [sessionReady, setSessionReady] = useState(false)
  const [sessionError, setSessionError] = useState<string | null>(null)

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [submitMsg, setSubmitMsg] = useState<string | null>(null)

  // ── Extraire le token depuis le hash et établir la session ──────────────────
  useEffect(() => {
    const hash = window.location.hash.substring(1) // retire le #
    const params = new URLSearchParams(hash)
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')

    if (!accessToken || !refreshToken) {
      setSessionError('Lien de réinitialisation invalide ou expiré.')
      return
    }

    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) {
          setSessionError(error.message)
        } else {
          setSessionReady(true)
        }
      })
  }, [])

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setValidationError(null)

    if (password.length < 6) {
      setValidationError('Le mot de passe doit contenir au moins 6 caractères.')
      return
    }
    if (password !== confirm) {
      setValidationError('Les deux mots de passe ne correspondent pas.')
      return
    }

    setSubmitStatus('loading')
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setSubmitStatus('error')
      setSubmitMsg(error.message)
    } else {
      setSubmitStatus('success')
      setSubmitMsg('Mot de passe mis à jour !')
      setTimeout(() => router.push('/dashboard'), 2000)
    }
  }

  // ── Rendu ───────────────────────────────────────────────────────────────────
  return (
    <main
      className="flex min-h-screen items-center justify-center px-4"
      style={{ backgroundColor: '#0a1628' }}
    >
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-black text-white">
            Nouveau mot de passe
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Choisissez un nouveau mot de passe pour votre compte.
          </p>
        </div>

        {/* Erreur de session (lien invalide) */}
        {sessionError && (
          <div className="rounded-xl border border-red-700/40 bg-red-900/20 px-4 py-3 text-sm text-red-400">
            {sessionError}
          </div>
        )}

        {/* Succès */}
        {submitStatus === 'success' && (
          <div className="rounded-xl border border-green-600/30 bg-green-900/20 px-4 py-3 text-sm font-medium text-green-400 text-center">
            ✅ {submitMsg}
            <p className="mt-1 text-xs text-green-600">Redirection vers le tableau de bord…</p>
          </div>
        )}

        {/* Formulaire */}
        {!sessionError && submitStatus !== 'success' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Erreur de validation ou d'envoi */}
            {(validationError || submitStatus === 'error') && (
              <div className="rounded-xl border border-red-700/40 bg-red-900/20 px-4 py-3 text-sm text-red-400">
                {validationError ?? submitMsg}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-400">
                  Nouveau mot de passe
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="••••••••"
                  disabled={!sessionReady || submitStatus === 'loading'}
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-[#dc2626] focus:outline-none focus:ring-1 focus:ring-[#dc2626] disabled:opacity-50"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-400">
                  Confirmer le mot de passe
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={6}
                  placeholder="••••••••"
                  disabled={!sessionReady || submitStatus === 'loading'}
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-600 focus:border-[#dc2626] focus:outline-none focus:ring-1 focus:ring-[#dc2626] disabled:opacity-50"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!sessionReady || submitStatus === 'loading'}
              className="w-full rounded-xl py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#f97316' }}
            >
              {submitStatus === 'loading' ? 'Mise à jour…' : 'Mettre à jour le mot de passe'}
            </button>

            {!sessionReady && !sessionError && (
              <p className="text-center text-xs text-gray-600">Vérification du lien…</p>
            )}
          </form>
        )}
      </div>
    </main>
  )
}
