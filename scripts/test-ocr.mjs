#!/usr/bin/env node
/**
 * Usage: node scripts/test-ocr.mjs <chemin-image>
 *
 * Pipeline complet :
 *  1. Prétraitement Sharp  → orientation EXIF + resize 1500px + JPEG q85
 *  2. Google Vision        → DOCUMENT_TEXT_DETECTION
 *  3. Extraction stickers  → blocs contenant "kg" → nom avant la date
 *  4. Matching CSV 4 passes → exact / Levenshtein complet / prénom+nom / nom seul
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// ════════════════════════════════════════════════════════════
// 0. Helpers généraux
// ════════════════════════════════════════════════════════════

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

function hr(char = '─', n = 62) { return char.repeat(n) }
function log(msg = '') { console.log(msg) }

// ════════════════════════════════════════════════════════════
// 1. Levenshtein + similarité (pur JS)
// ════════════════════════════════════════════════════════════

function levenshtein(a, b) {
  const m = a.length, n = b.length
  // Ligne courante et précédente seulement → O(min(m,n)) mémoire
  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    const curr = [i]
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    prev = curr
  }
  return prev[n]
}

/** Similarité normalisée [0, 1] — 1 = identique */
function similarity(a, b) {
  if (!a && !b) return 1
  if (!a || !b) return 0
  const maxLen = Math.max(a.length, b.length)
  return 1 - levenshtein(a, b) / maxLen
}

// ════════════════════════════════════════════════════════════
// 2. Normalisation de texte
// ════════════════════════════════════════════════════════════

function normalize(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // retirer les diacritiques
    .replace(/[^a-z0-9\s]/g, '')       // retirer tout sauf lettres/chiffres/espaces
    .replace(/\s+/g, ' ')
    .trim()
}

// ════════════════════════════════════════════════════════════
// 3. Chargement du CSV stickers_reference
// ════════════════════════════════════════════════════════════

function loadCSV() {
  const csvPath = resolve(ROOT, 'stickers_reference.csv')
  if (!existsSync(csvPath)) {
    log(`⚠️   stickers_reference.csv introuvable à la racine (${csvPath}).`)
    log('    Le matching sera ignoré.')
    return null
  }
  const lines = readFileSync(csvPath, 'utf8').split('\n')
  const header = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  // Colonnes attendues : sticker_id, country, display_name, normalized_name, category
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    // Parser CSV simple (pas de virgules dans les champs)
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
    const row = {}
    header.forEach((h, idx) => { row[h] = cols[idx] ?? '' })
    if (row.sticker_id) rows.push(row)
  }
  log(`📋  CSV chargé : ${rows.length} stickers de référence.`)
  return rows
}

// ════════════════════════════════════════════════════════════
// 4. Matching 4 passes
// ════════════════════════════════════════════════════════════

const THRESH_PASS2 = 0.85
const THRESH_PASS3 = 0.75
const THRESH_PASS4 = 0.80

function matchSticker(rawName, refRows) {
  if (!refRows) return { pass: null, sticker_id: null, display_name: null, score: 0 }

  const normName = normalize(rawName)

  // ── Passe 1 : correspondance exacte sur normalized_name ──
  const exact = refRows.find(r => normalize(r.normalized_name) === normName)
  if (exact) {
    return { pass: 1, sticker_id: exact.sticker_id, display_name: exact.display_name, score: 1.0 }
  }

  // ── Passe 2 : Levenshtein sur nom complet normalisé ──────
  let best2 = null, bestScore2 = 0
  for (const r of refRows) {
    const s = similarity(normName, normalize(r.normalized_name))
    if (s > bestScore2) { bestScore2 = s; best2 = r }
  }
  if (bestScore2 >= THRESH_PASS2) {
    return { pass: 2, sticker_id: best2.sticker_id, display_name: best2.display_name, score: bestScore2 }
  }

  // ── Passe 3 : prénom × 0.4 + nom × 0.6 ─────────────────
  const words = normName.split(' ').filter(Boolean)
  const lastName3  = words[words.length - 1] ?? ''
  const firstName3 = words.slice(0, -1).join(' ')

  let best3 = null, bestScore3 = 0
  for (const r of refRows) {
    const refNorm  = normalize(r.normalized_name)
    const refWords = refNorm.split(' ').filter(Boolean)
    const refLast  = refWords[refWords.length - 1] ?? ''
    const refFirst = refWords.slice(0, -1).join(' ')
    const s = similarity(lastName3, refLast) * 0.6
           + (firstName3 && refFirst
               ? similarity(firstName3, refFirst) * 0.4
               : 0)
    if (s > bestScore3) { bestScore3 = s; best3 = r }
  }
  if (bestScore3 >= THRESH_PASS3) {
    return { pass: 3, sticker_id: best3.sticker_id, display_name: best3.display_name, score: bestScore3 }
  }

  // ── Passe 4 : Levenshtein sur dernier mot seul ───────────
  const lastWord = normalize(rawName).split(' ').filter(Boolean).pop() ?? ''
  const candidates4 = []
  for (const r of refRows) {
    const refLast = normalize(r.normalized_name).split(' ').filter(Boolean).pop() ?? ''
    const s = similarity(lastWord, refLast)
    if (s >= THRESH_PASS4) candidates4.push({ row: r, score: s })
  }
  if (candidates4.length === 1) {
    const { row, score } = candidates4[0]
    return { pass: 4, sticker_id: row.sticker_id, display_name: row.display_name, score }
  }

  return { pass: null, sticker_id: null, display_name: null, score: 0 }
}

// ════════════════════════════════════════════════════════════
// 5. Extraction des blocs Vision → stickers
// ════════════════════════════════════════════════════════════

/**
 * Reconstitue le texte d'un paragraphe depuis ses mots/symboles.
 */
function paragraphText(para) {
  return para.words
    .map(w =>
      w.symbols.map(s => {
        const t = s.text ?? ''
        const br = s.property?.detectedBreak?.type
        return (br === 'SPACE' || br === 'EOL_SURE_SPACE' || br === 'LINE_BREAK')
          ? t + ' ' : t
      }).join('')
    )
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Retourne le Y minimum (bord supérieur) d'un bounding poly.
 */
function topY(vertices) {
  return Math.min(...(vertices ?? []).map(v => v.y ?? 0))
}

/**
 * À partir de la réponse Vision, renvoie tous les paragraphes avec leur topY.
 * Chaque entrée : { text: string, topY: number }
 */
function extractParagraphs(annotation) {
  const paras = []
  for (const page of annotation?.fullTextAnnotation?.pages ?? []) {
    for (const block of page.blocks ?? []) {
      for (const para of block.paragraphs ?? []) {
        const text = paragraphText(para)
        if (!text) continue
        const y = topY(para.boundingBox?.vertices)
        paras.push({ text, topY: y })
      }
    }
  }
  return paras
}

/**
 * Fallback : parmi tous les paragraphes, trouve celui dont le topY est
 * immédiatement au-dessus du bloc kg (topY < kgTopY), sans date, sans
 * "kg", "PANINI" ni "FIFA". Retourne le texte du plus proche, ou null.
 */
function fallbackNameBlock(allParas, kgTopY) {
  const NOISE_RE = /\bkg\b|panini|fifa|\d{1,2}[-./]\d{1,2}[-./]\d{4}/i
  const candidates = allParas.filter(p =>
    p.topY < kgTopY && !NOISE_RE.test(p.text)
  )
  if (candidates.length === 0) return null
  // Le plus proche = topY le plus grand parmi ceux qui sont au-dessus
  candidates.sort((a, b) => b.topY - a.topY)
  return candidates[0].text
}

/**
 * Pour chaque paragraphe contenant "kg", extrait le nom du joueur =
 * tout ce qui précède le premier pattern de date dd-mm-yyyy (trimé).
 */
const DATE_RE = /\d{1,2}[-./]\d{1,2}[-./]\d{4}/

function extractNameFromBlock(text) {
  const match = DATE_RE.exec(text)
  if (!match) return null                  // pas de date → pas un sticker
  const before = text.slice(0, match.index).trim()
  return before || null
}

// ════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════

loadEnvLocal()

const imagePath = process.argv[2]
if (!imagePath) {
  console.error('Usage: node scripts/test-ocr.mjs <chemin-image>')
  process.exit(1)
}
const resolvedPath = resolve(imagePath)
if (!existsSync(resolvedPath)) {
  console.error(`❌  Image introuvable : ${resolvedPath}`)
  process.exit(1)
}
const apiKey = process.env.GOOGLE_VISION_API_KEY
if (!apiKey) {
  console.error('❌  GOOGLE_VISION_API_KEY absent du .env.local.')
  process.exit(1)
}

// ── Étape 1 : Prétraitement Sharp ───────────────────────────

log(hr('═'))
log('  ÉTAPE 1 — PRÉTRAITEMENT SHARP')
log(hr('═'))

const rawBuf = readFileSync(resolvedPath)
const meta   = await sharp(rawBuf).metadata()
log(`📷  Source    : ${resolvedPath}`)
log(`📐  Avant     : ${meta.width} × ${meta.height} px  |  format: ${meta.format}  |  orientation EXIF: ${meta.orientation ?? 'absente'}`)

const processedBuf = await sharp(rawBuf)
  .rotate()
  .resize(1500, 1500, { fit: 'inside', withoutEnlargement: true })
  .jpeg({ quality: 85 })
  .toBuffer()

const pmeta = await sharp(processedBuf).metadata()
log(`✅  Après     : ${pmeta.width} × ${pmeta.height} px  |  ${(processedBuf.length / 1024).toFixed(1)} Ko`)
log()

// ── Étape 2 : Google Vision ──────────────────────────────────

log(hr('═'))
log('  ÉTAPE 2 — GOOGLE CLOUD VISION (DOCUMENT_TEXT_DETECTION)')
log(hr('═'))
log('🔍  Envoi en cours…')

const visionRes = await fetch(
  `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{
        image: { content: processedBuf.toString('base64') },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
      }],
    }),
  }
)

if (!visionRes.ok) {
  console.error(`❌  HTTP ${visionRes.status} :`, await visionRes.text())
  process.exit(1)
}

const visionData = await visionRes.json()
const annotation = visionData.responses?.[0]

if (annotation?.error) {
  console.error('❌  Vision API :', annotation.error.message)
  process.exit(1)
}

const fullText = annotation?.fullTextAnnotation?.text ?? ''
log(`✅  Texte brut reçu (${fullText.length} caractères)`)
log()
log(hr())
log(fullText.trim() || '(aucun texte)')
log(hr())
log()

// ── Étape 3 : Extraction des stickers ───────────────────────

log(hr('═'))
log('  ÉTAPE 3 — EXTRACTION DES STICKERS (blocs "kg")')
log(hr('═'))

const paragraphs = extractParagraphs(annotation)
log(`  ${paragraphs.length} paragraphe(s) analysé(s).`)
log()

const stickers = []
for (const para of paragraphs) {
  if (!/\bkg\b/i.test(para.text)) continue
  const name = extractNameFromBlock(para.text)
  stickers.push({ rawBlock: para.text, kgTopY: para.topY, rawName: name })
}

log(`⚽  ${stickers.length} sticker(s) détecté(s) (bloc contenant "kg").`)

if (stickers.length === 0) {
  // Affiche les blocs bruts pour debug
  log()
  log('  Blocs bruts (debug) :')
  paragraphs.forEach((p, i) => log(`  [${String(i).padStart(2)}] y=${String(p.topY).padStart(4)}  "${p.text}"`))
}
log()

// ── Étape 4 : Matching CSV ───────────────────────────────────

log(hr('═'))
log('  ÉTAPE 4 — MATCHING CSV 4 PASSES')
log(hr('═'))

const refRows = loadCSV()
log()

const passCount = { 1: 0, 2: 0, 3: 0, 4: 0, null: 0 }

for (let i = 0; i < stickers.length; i++) {
  const { rawBlock, kgTopY, rawName: rawNameDirect } = stickers[i]
  log(hr())
  log(`  Sticker #${i + 1}`)
  log(hr())
  log(`  Bloc brut       : "${rawBlock}"`)

  let rawName = rawNameDirect
  let nameSource = 'date'

  if (!rawName) {
    const fallback = fallbackNameBlock(paragraphs, kgTopY)
    if (fallback) {
      rawName = fallback
      nameSource = 'fallback (bloc au-dessus)'
      log(`  ⚠️   Pas de date → fallback : "${rawName}"`)
    } else {
      log(`  ⚠️   Nom extrait   : (aucune date, aucun bloc au-dessus exploitable)`)
      passCount[null]++
      log()
      continue
    }
  }

  const normName = normalize(rawName)
  if (nameSource === 'date') log(`  Nom extrait     : "${rawName}"`)
  log(`  Nom normalisé   : "${normName}"  [source: ${nameSource}]`)

  const result = matchSticker(rawName, refRows)
  passCount[result.pass ?? null]++

  if (result.pass) {
    const passLabel = ['', 'exact', 'Levenshtein complet', 'prénom+nom', 'nom seul'][result.pass]
    log(`  ✅  Passe ${result.pass} (${passLabel})`)
    log(`  sticker_id      : ${result.sticker_id}`)
    log(`  display_name    : ${result.display_name}`)
    log(`  Score           : ${(result.score * 100).toFixed(1)} %`)
  } else {
    log(`  ❌  Non matché (meilleur score insuffisant)`)
  }
  log()
}

// ── Résumé final ─────────────────────────────────────────────

log(hr('═'))
log('  RÉSUMÉ')
log(hr('═'))
log(`  Stickers détectés : ${stickers.length}`)
if (stickers.length > 0) {
  const matched = stickers.length - passCount[null]
  log(`  Matchés           : ${matched} / ${stickers.length}`)
  if (passCount[1]) log(`    · Passe 1 (exact)              : ${passCount[1]}`)
  if (passCount[2]) log(`    · Passe 2 (Levenshtein complet): ${passCount[2]}`)
  if (passCount[3]) log(`    · Passe 3 (prénom + nom)       : ${passCount[3]}`)
  if (passCount[4]) log(`    · Passe 4 (nom seul)           : ${passCount[4]}`)
  if (passCount[null]) log(`    · Non matchés                  : ${passCount[null]}`)
}
log(hr('═'))
