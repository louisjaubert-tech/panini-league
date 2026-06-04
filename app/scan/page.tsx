'use client'

import { useActionState, useRef, useState, useEffect } from 'react'
import Image from 'next/image'
import { uploadPack } from '@/app/actions/scan'

export default function ScanPage() {
  const [state, action, pending] = useActionState(uploadPack, {})
  const [preview, setPreview] = useState<string | null>(null)
  const [hasFile, setHasFile] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.success) {
      setPreview(null)
      setHasFile(false)
      formRef.current?.reset()
    }
  }, [state.success])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setHasFile(true)
    const url = URL.createObjectURL(file)
    setPreview(url)
  }

  function handleReset() {
    setPreview(null)
    setHasFile(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <main className="mx-auto max-w-lg px-4 sm:px-6 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Scanner un blister</h1>
          <p className="mt-1 text-sm text-gray-500">
            Prends en photo ton blister Panini pour l&apos;analyser.
          </p>
        </div>

        {state.success ? (
          <div className="rounded-2xl bg-green-50 border border-green-200 p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <p className="text-lg font-semibold text-green-800">Photo envoyée !</p>
            <p className="mt-1 text-sm text-green-700">Analyse en cours…</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-6 rounded-lg border border-green-300 px-4 py-2 text-sm font-medium text-green-800 hover:bg-green-100 transition-colors"
            >
              Scanner un autre blister
            </button>
          </div>
        ) : (
          <form ref={formRef} action={action} className="space-y-6">
            {state.error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {state.error}
              </div>
            )}

            <input
              ref={inputRef}
              id="photo"
              name="photo"
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={handleFileChange}
            />

            {!preview ? (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-gray-300 bg-white px-6 py-16 text-center hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100">
                  <svg className="h-7 w-7 text-indigo-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700">Scanner mon blister</p>
                  <p className="mt-0.5 text-xs text-gray-400">Caméra sur mobile · Galerie sur desktop</p>
                </div>
              </button>
            ) : (
              <div className="space-y-4">
                <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white">
                  <Image
                    src={preview}
                    alt="Aperçu du blister"
                    width={600}
                    height={400}
                    className="h-72 w-full object-contain"
                    unoptimized
                  />
                  <button
                    type="button"
                    onClick={handleReset}
                    className="absolute right-3 top-3 rounded-full bg-white/90 p-1.5 shadow hover:bg-white transition-colors"
                    aria-label="Changer la photo"
                  >
                    <svg className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={pending}
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    Changer
                  </button>
                  <button
                    type="submit"
                    disabled={pending || !hasFile}
                    className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    {pending ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Envoi…
                      </span>
                    ) : 'Envoyer'}
                  </button>
                </div>
              </div>
            )}
          </form>
        )}
    </main>
  )
}
