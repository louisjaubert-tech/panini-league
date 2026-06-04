#!/usr/bin/env node
/**
 * Usage: node scripts/test-process-scan.mjs
 *
 * Récupère le pack_openings le plus récent avec ocr_status = 'pending'
 * pour l'user donné, puis appelle POST /api/process-scan.
 * Le serveur Next.js doit être lancé sur http://localhost:3000.
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// ── Charger .env.local ───────────────────────────────────────

function loadEnvLocal() {
  const p = resolve(ROOT, '.env.local')
  if (!existsSync(p)) { console.error('❌  .env.local introuvable.'); process.exit(1) }
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim()
  }
}

loadEnvLocal()

const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env

if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌  NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY absent du .env.local.')
  process.exit(1)
}

// ── Récupérer le pack pending le plus récent ─────────────────

const BASE_URL = 'http://localhost:3000'
const USER_ID  = 'aa35b926-03c8-42d5-af70-ba1299ddaa84'

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

console.log(`🔍  Recherche du dernier pack pending pour user ${USER_ID}…`)

const { data: packs, error } = await supabase
  .from('pack_openings')
  .select('id, opened_at, photo_url, ocr_status')
  .eq('user_id', USER_ID)
  .eq('ocr_status', 'pending')
  .order('opened_at', { ascending: false })
  .limit(1)

if (error) {
  console.error('❌  Erreur Supabase :', error.message)
  process.exit(1)
}

if (!packs || packs.length === 0) {
  console.error('❌  Aucun pack avec ocr_status = "pending" trouvé pour cet user.')
  process.exit(1)
}

const pack = packs[0]
console.log(`✅  pack_id      : ${pack.id}`)
console.log(`   opened_at    : ${pack.opened_at}`)
console.log(`   ocr_status   : ${pack.ocr_status}`)
console.log(`   photo_url    : ${pack.photo_url}`)
console.log()

// ── Appel POST /api/process-scan ─────────────────────────────

const payload = { pack_id: pack.id, user_id: USER_ID }

console.log('📤  POST', `${BASE_URL}/api/process-scan`)
console.log('    Payload :', JSON.stringify(payload))
console.log()

const res = await fetch(`${BASE_URL}/api/process-scan`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
})

console.log(`📥  Status : ${res.status} ${res.statusText}`)
console.log()

const data = await res.json()
console.log('📋  Réponse :')
console.log(JSON.stringify(data, null, 2))
