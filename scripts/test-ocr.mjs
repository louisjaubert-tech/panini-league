#!/usr/bin/env node
/**
 * Usage: node scripts/test-ocr.mjs <chemin-image>
 *
 * - Corrige l'orientation EXIF, redimensionne à 1500px max, exporte JPEG q85
 * - Envoie à Google Cloud Vision DOCUMENT_TEXT_DETECTION
 * - Affiche le texte brut complet
 * - Affiche chaque bloc avec ses coordonnées bounding box
 * - Identifie les ancres "kg" et remonte le candidat nom du joueur
 * - Détecte les textes entre parenthèses dans les blocs proches → candidat pays
 */

import { readFileSync, existsSync, writeFileSync } from 'fs'
import { resolve, dirname, basename, extname } from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

// ── Chemins ─────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')

// ── Charger .env.local ───────────────────────────────────────────────────────

function loadEnvLocal() {
  const envPath = resolve(rootDir, '.env.local')
  if (!existsSync(envPath)) {
    console.error('❌  .env.local introuvable à la racine du projet.')
    process.exit(1)
  }
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim()
  }
}

loadEnvLocal()

// ── Arguments ────────────────────────────────────────────────────────────────

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

// ── Pré-traitement avec Sharp ─────────────────────────────────────────────────

console.log(`📷  Image source : ${resolvedPath}`)

const originalBuffer = readFileSync(resolvedPath)

// Lire les métadonnées EXIF
const meta = await sharp(originalBuffer).metadata()
console.log(`📐  Dimensions originales : ${meta.width} × ${meta.height} px`)
console.log(`🔄  Orientation EXIF : ${meta.orientation ?? 'absente'}`)
console.log(`📁  Format : ${meta.format}`)

// Corriger l'orientation, redimensionner, exporter JPEG q85
const MAX_SIDE = 1500
const processedBuffer = await sharp(originalBuffer)
  .rotate()                          // corrige l'orientation EXIF automatiquement
  .resize(MAX_SIDE, MAX_SIDE, {
    fit: 'inside',                   // conserve le ratio, 1500px max sur le plus long côté
    withoutEnlargement: true,        // ne pas agrandir si déjà plus petit
  })
  .jpeg({ quality: 85 })
  .toBuffer()

const processedMeta = await sharp(processedBuffer).metadata()
console.log(`✅  Après traitement : ${processedMeta.width} × ${processedMeta.height} px`)
console.log(`📦  Taille : ${(processedBuffer.length / 1024).toFixed(1)} Ko\n`)

// Sauvegarder l'image traitée pour inspection
const outName = basename(resolvedPath, extname(resolvedPath)) + '_processed.jpg'
const outPath = resolve(rootDir, 'scripts', outName)
writeFileSync(outPath, processedBuffer)
console.log(`💾  Image traitée sauvegardée : ${outPath}\n`)

// ── Appel Google Vision DOCUMENT_TEXT_DETECTION ──────────────────────────────

const base64Image = processedBuffer.toString('base64')
const endpoint = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`

console.log('🔍  Envoi à Google Cloud Vision (DOCUMENT_TEXT_DETECTION)…\n')

const response = await fetch(endpoint, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    requests: [{
      image: { content: base64Image },
      features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
    }],
  }),
})

if (!response.ok) {
  console.error(`❌  Erreur HTTP ${response.status} :`, await response.text())
  process.exit(1)
}

const data = await response.json()
const annotation = data.responses?.[0]

if (annotation?.error) {
  console.error('❌  Erreur Vision API :', annotation.error.message)
  process.exit(1)
}

// ── Texte brut complet ───────────────────────────────────────────────────────

const fullText = annotation?.fullTextAnnotation?.text ?? ''
console.log('━'.repeat(60))
console.log('📄  TEXTE BRUT COMPLET')
console.log('━'.repeat(60))
console.log(fullText.trim() || '(aucun texte détecté)')
console.log()

// ── Extraction des blocs (paragraphes) ──────────────────────────────────────

/**
 * Convertit un bounding poly Vision en { x, y, width, height }.
 * Les vertices sont dans l'ordre : TL, TR, BR, BL.
 */
function polyToRect(vertices) {
  const xs = vertices.map(v => v.x ?? 0)
  const ys = vertices.map(v => v.y ?? 0)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return {
    x,
    y,
    width:  Math.max(...xs) - x,
    height: Math.max(...ys) - y,
  }
}

/**
 * Reconstitue le texte d'un paragraphe depuis ses mots/symboles.
 */
function paragraphText(paragraph) {
  return paragraph.words
    .map(w =>
      w.symbols.map(s => {
        const t = s.text ?? ''
        const br = s.property?.detectedBreak?.type
        return br === 'SPACE' || br === 'EOL_SURE_SPACE' || br === 'LINE_BREAK'
          ? t + ' '
          : t
      }).join('')
    )
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Aplatir toutes les pages → blocs → paragraphes en une liste plate
const blocks = []

for (const page of annotation?.fullTextAnnotation?.pages ?? []) {
  for (const block of page.blocks ?? []) {
    for (const para of block.paragraphs ?? []) {
      const text = paragraphText(para)
      if (!text) continue
      const rect = polyToRect(para.boundingBox?.vertices ?? [])
      blocks.push({ text, rect })
    }
  }
}

// ── Affichage de tous les blocs ───────────────────────────────────────────────

console.log('━'.repeat(60))
console.log(`📦  BLOCS DÉTECTÉS (${blocks.length})`)
console.log('━'.repeat(60))

blocks.forEach((b, i) => {
  const { x, y, width, height } = b.rect
  console.log(`[${String(i).padStart(3, '0')}] "${b.text}"`)
  console.log(`       bbox → x:${x} y:${y} w:${width} h:${height}`)
})
console.log()

// ── Recherche des ancres "kg" ─────────────────────────────────────────────────

/**
 * Retourne le centre Y d'un rect.
 */
function centerY(rect) {
  return rect.y + rect.height / 2
}

/**
 * Retourne le centre X d'un rect.
 */
function centerX(rect) {
  return rect.x + rect.width / 2
}

/**
 * Vérifie si deux blocs sont à peu près alignés horizontalement
 * (centres X à moins de 40 % de la largeur de l'image).
 */
function isHorizontallyClose(a, b, imgWidth) {
  return Math.abs(centerX(a) - centerX(b)) < imgWidth * 0.40
}

const imgWidth = processedMeta.width ?? 1500

const kgBlocks = blocks.filter(b =>
  /\bkg\b/i.test(b.text) || /\d+[.,]\d*\s*kg/i.test(b.text)
)

console.log('━'.repeat(60))
console.log(`⚓  ANCRES "kg" TROUVÉES (${kgBlocks.length})`)
console.log('━'.repeat(60))

if (kgBlocks.length === 0) {
  console.log('  Aucune ancre "kg" détectée.')
} else {
  for (const kgBlock of kgBlocks) {
    console.log(`\n  Ancre : "${kgBlock.text}"  (y=${kgBlock.rect.y})`)

    // Blocs au-dessus de l'ancre, alignés horizontalement, triés par proximité
    const above = blocks
      .filter(b =>
        b !== kgBlock &&
        centerY(b.rect) < centerY(kgBlock.rect) &&
        isHorizontallyClose(b.rect, kgBlock.rect, imgWidth)
      )
      .sort((a, b) => centerY(b.rect) - centerY(a.rect)) // le plus proche en premier

    const nameCandidate = above[0]
    if (nameCandidate) {
      console.log(`  🏷️   Candidat nom     : "${nameCandidate.text}"`)
    } else {
      console.log('  🏷️   Candidat nom     : (non trouvé)')
    }

    // Chercher un texte entre parenthèses dans les blocs proches (±150px verticalement)
    const PROXIMITY = 150
    const nearbyParenText = blocks
      .filter(b => {
        if (b === kgBlock || b === nameCandidate) return false
        const yDist = Math.abs(centerY(b.rect) - centerY(kgBlock.rect))
        return yDist < PROXIMITY && isHorizontallyClose(b.rect, kgBlock.rect, imgWidth)
      })
      .map(b => {
        const match = b.text.match(/\(([^)]+)\)/)
        return match ? match[1].trim() : null
      })
      .filter(Boolean)

    if (nearbyParenText.length > 0) {
      console.log(`  🌍  Candidat pays    : "${nearbyParenText[0]}"`)
    } else {
      // Chercher dans le texte des blocs proches un pattern pays entre parenthèses
      const inNameBlock = nameCandidate?.text.match(/\(([^)]+)\)/)
      if (inNameBlock) {
        console.log(`  🌍  Candidat pays    : "${inNameBlock[1].trim()}" (dans le bloc nom)`)
      } else {
        console.log('  🌍  Candidat pays    : (non trouvé)')
      }
    }
  }
}

console.log()
console.log(`✅  Terminé. ${blocks.length} blocs analysés, ${kgBlocks.length} ancre(s) "kg" trouvée(s).`)
