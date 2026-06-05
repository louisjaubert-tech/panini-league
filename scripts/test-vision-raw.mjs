#!/usr/bin/env node
/**
 * Usage: node scripts/test-vision-raw.mjs <url>
 *
 * Télécharge l'image depuis l'URL, l'envoie à Google Vision
 * DOCUMENT_TEXT_DETECTION et affiche le texte brut complet.
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

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

const apiKey = process.env.GOOGLE_VISION_API_KEY
if (!apiKey) {
  console.error('❌  GOOGLE_VISION_API_KEY absent du .env.local.')
  process.exit(1)
}

const imageUrl = process.argv[2]
if (!imageUrl) {
  console.error('Usage: node scripts/test-vision-raw.mjs <url>')
  process.exit(1)
}

// ── Télécharger l'image ──────────────────────────────────────

console.log(`📥  Téléchargement : ${imageUrl}`)

const imgRes = await fetch(imageUrl)
if (!imgRes.ok) {
  console.error(`❌  Impossible de télécharger l'image (HTTP ${imgRes.status}).`)
  process.exit(1)
}

const buffer = Buffer.from(await imgRes.arrayBuffer())
console.log(`📦  Taille : ${(buffer.length / 1024).toFixed(1)} Ko`)
console.log()

// ── Appel Google Vision ──────────────────────────────────────

console.log('🔍  Envoi à Google Cloud Vision (DOCUMENT_TEXT_DETECTION)…')

const visionRes = await fetch(
  `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{
        image: { content: buffer.toString('base64') },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
      }],
    }),
  }
)

if (!visionRes.ok) {
  console.error(`❌  Vision API HTTP ${visionRes.status} :`, await visionRes.text())
  process.exit(1)
}

const data = await visionRes.json()
const annotation = data.responses?.[0]

if (annotation?.error) {
  console.error('❌  Vision API error :', annotation.error.message)
  process.exit(1)
}

const fullText = annotation?.fullTextAnnotation?.text ?? ''

console.log(`✅  ${fullText.length} caractères reçus`)
console.log('─'.repeat(62))
console.log(fullText.trim() || '(aucun texte détecté)')
console.log('─'.repeat(62))
