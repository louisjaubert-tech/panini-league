#!/usr/bin/env node
/**
 * Usage: node scripts/test-process-scan.mjs
 *
 * Récupère TOUS les packs avec ocr_status = 'pending' pour l'user donné,
 * les traite un par un dans l'ordre chronologique et affiche le résultat.
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

const BASE_URL = 'http://localhost:3000'
const USER_ID  = 'aa35b926-03c8-42d5-af70-ba1299ddaa84'

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// ── Récupérer tous les packs pending, ordre chronologique ────

console.log(`🔍  Recherche des packs pending pour user ${USER_ID}…`)

const { data: packs, error } = await supabase
  .from('pack_openings')
  .select('id, opened_at, photo_url, ocr_status')
  .eq('user_id', USER_ID)
  .eq('ocr_status', 'pending')
  .order('opened_at', { ascending: true })

if (error) {
  console.error('❌  Erreur Supabase :', error.message)
  process.exit(1)
}

if (!packs || packs.length === 0) {
  console.error('❌  Aucun pack avec ocr_status = "pending" trouvé pour cet user.')
  process.exit(1)
}

console.log(`✅  ${packs.length} pack(s) pending trouvé(s).`)
console.log()

// ── Traiter chaque pack séquentiellement ─────────────────────

const summary = []

for (let i = 0; i < packs.length; i++) {
  const pack = packs[i]

  console.log('═'.repeat(62))
  console.log(`  PACK ${i + 1} / ${packs.length}`)
  console.log('═'.repeat(62))
  console.log(`  pack_id    : ${pack.id}`)
  console.log(`  opened_at  : ${pack.opened_at}`)
  console.log(`  photo_url  : ${pack.photo_url}`)
  console.log()

  const payload = { pack_id: pack.id, user_id: USER_ID }

  console.log(`📤  POST ${BASE_URL}/api/process-scan`)
  console.log(`    Payload : ${JSON.stringify(payload)}`)
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
  console.log()

  // Résumé court pour ce pack
  const stickers = data.stickers ?? []
  const matched     = stickers.filter(s => s.status === 'matched').length
  const needsReview = stickers.filter(s => s.status === 'needs_review').length
  const unmatched   = stickers.filter(s => s.status === 'unmatched').length
  const newBadges   = (data.new_badges ?? []).length

  summary.push({
    index: i + 1,
    pack_id: pack.id,
    opened_at: pack.opened_at,
    http: res.status,
    total: stickers.length,
    matched,
    needsReview,
    unmatched,
    newBadges,
  })
}

// ── Résumé global ─────────────────────────────────────────────

console.log('═'.repeat(62))
console.log('  RÉSUMÉ GLOBAL')
console.log('═'.repeat(62))
console.log(`  ${packs.length} pack(s) traité(s)\n`)

for (const s of summary) {
  const status = s.http === 200 ? '✅' : '❌'
  console.log(`  ${status} Pack ${s.index}  ${s.pack_id}`)
  console.log(`     opened_at : ${s.opened_at}`)
  if (s.http === 200) {
    console.log(`     stickers  : ${s.total} total — ${s.matched} matchés, ${s.needsReview} à revoir, ${s.unmatched} non matchés`)
    if (s.newBadges > 0) console.log(`     badges    : ${s.newBadges} nouveau(x)`)
  } else {
    console.log(`     HTTP ${s.http}`)
  }
  console.log()
}
