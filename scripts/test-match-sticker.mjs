#!/usr/bin/env node
/**
 * Usage: node scripts/test-match-sticker.mjs
 *
 * Appelle POST /api/match-sticker avec des données de test et affiche la réponse.
 * Le serveur Next.js doit être lancé sur http://localhost:3000.
 * Le pack_id est récupéré automatiquement depuis pack_openings via Supabase.
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

// ── Récupérer le premier pack_id existant pour l'user ────────

const BASE_URL = 'http://localhost:3000'
const USER_ID  = 'aa35b926-03c8-42d5-af70-ba1299ddaa84'

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

console.log(`🔍  Récupération du premier pack_openings pour user ${USER_ID}…`)

const { data: packs, error } = await supabase
  .from('pack_openings')
  .select('id, opened_at')
  .eq('user_id', USER_ID)
  .order('opened_at', { ascending: false })
  .limit(1)

if (error) {
  console.error('❌  Erreur Supabase :', error.message)
  process.exit(1)
}

if (!packs || packs.length === 0) {
  console.error('❌  Aucun pack trouvé dans pack_openings pour cet user.')
  process.exit(1)
}

const pack_id = packs[0].id
console.log(`✅  pack_id trouvé : ${pack_id}  (ouvert le ${packs[0].opened_at})`)
console.log()

// ── Appel POST /api/match-sticker ────────────────────────────

const payload = {
  pack_id,
  user_id: USER_ID,
  blocs: [
    'DIOGO DALOT 18-3-1999 1.83 m / 78 kg MANCHESTER UNITED FC (ENG)',
    'SEUNGHO PAIK 17-3-1987 11,82 m / 68 kg BIRMINGHAM CITY FC ENG',
  ],
}

console.log('📤  POST', `${BASE_URL}/api/match-sticker`)
console.log('    Payload :')
console.log(JSON.stringify(payload, null, 2))
console.log()

const res = await fetch(`${BASE_URL}/api/match-sticker`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
})

console.log(`📥  Status : ${res.status} ${res.statusText}`)
console.log()

const data = await res.json()
console.log('📋  Réponse :')
console.log(JSON.stringify(data, null, 2))
