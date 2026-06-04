import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { matchStickers } from '@/lib/matchSticker'
import { checkBadges } from '@/lib/checkBadges'

// ════════════════════════════════════════════════════════════
// Helpers Vision — extraction des paragraphes avec coordonnées
// ════════════════════════════════════════════════════════════

type Vertex = { x?: number; y?: number }
type Para = { text: string; topY: number; cx: number; cy: number }

function paragraphText(para: {
  words: Array<{
    symbols: Array<{
      text?: string
      property?: { detectedBreak?: { type?: string } }
    }>
  }>
}): string {
  return para.words
    .map(w =>
      w.symbols.map(s => {
        const t = s.text ?? ''
        const br = s.property?.detectedBreak?.type
        return br === 'SPACE' || br === 'EOL_SURE_SPACE' || br === 'LINE_BREAK'
          ? t + ' ' : t
      }).join('')
    )
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function centerOf(vertices: Vertex[] = []): { cx: number; cy: number } {
  if (vertices.length === 0) return { cx: 0, cy: 0 }
  const cx = vertices.reduce((s, v) => s + (v.x ?? 0), 0) / vertices.length
  const cy = vertices.reduce((s, v) => s + (v.y ?? 0), 0) / vertices.length
  return { cx, cy }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractParagraphs(annotation: any): Para[] {
  const paras: Para[] = []
  for (const page of annotation?.fullTextAnnotation?.pages ?? []) {
    for (const block of page.blocks ?? []) {
      for (const para of block.paragraphs ?? []) {
        const text = paragraphText(para)
        if (!text) continue
        const vertices: Vertex[] = para.boundingBox?.vertices ?? []
        const topY = Math.min(...vertices.map((v: Vertex) => v.y ?? 0))
        const { cx, cy } = centerOf(vertices)
        paras.push({ text, topY, cx, cy })
      }
    }
  }
  return paras
}

const NOISE_RE = /\bkg\b|pani\b|panini|fifa|\d+[-./]\d+[-./]\d{3,4}/i

// Détecte les noms de clubs : parenthèses, suffixes club connus, codes pays 3 lettres
const CLUB_RE = /[()（）]|\b(FC|SC|AC|CF|SL|BSC|UNAM)\b|\([A-Z]{3}\)/

/**
 * Retourne le paragraphe le plus proche en distance euclidienne du centre
 * du bloc kg, en excluant les blocs bruyants, les noms de clubs et ceux
 * de moins de 4 caractères.
 */
function fallbackNameBlock(
  allParas: Para[],
  kgPara: Para
): { text: string; distance: number } | null {
  let best: { para: Para; distance: number } | null = null

  for (const p of allParas) {
    if (p === kgPara) continue
    if (NOISE_RE.test(p.text)) continue
    if (CLUB_RE.test(p.text)) continue
    if (p.text.trim().length < 4) continue

    const dist = Math.sqrt(
      (p.cx - kgPara.cx) ** 2 +
      (p.cy - kgPara.cy) ** 2
    )
    if (!best || dist < best.distance) {
      best = { para: p, distance: dist }
    }
  }

  return best ? { text: best.para.text, distance: best.distance } : null
}

// ════════════════════════════════════════════════════════════
// POST handler
// ════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  // ── Validation ────────────────────────────────────────────
  let body: { pack_id?: unknown; user_id?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide.' }, { status: 400 })
  }

  const { pack_id, user_id } = body

  if (typeof pack_id !== 'string' || !pack_id) {
    return NextResponse.json({ error: '`pack_id` manquant.' }, { status: 400 })
  }
  if (typeof user_id !== 'string' || !user_id) {
    return NextResponse.json({ error: '`user_id` manquant.' }, { status: 400 })
  }

  const apiKey = process.env.GOOGLE_VISION_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GOOGLE_VISION_API_KEY non configurée.' }, { status: 500 })
  }

  // ── 1. Récupérer le pack et son photo_url ─────────────────
  const { data: pack, error: packErr } = await supabaseAdmin
    .from('pack_openings')
    .select('id, photo_url, ocr_status')
    .eq('id', pack_id)
    .eq('user_id', user_id)
    .single()

  if (packErr || !pack) {
    console.error('[process-scan] pack_openings fetch:', packErr?.message)
    return NextResponse.json({ error: 'Pack introuvable.' }, { status: 404 })
  }

  if (!pack.photo_url) {
    return NextResponse.json({ error: 'Ce pack n\'a pas de photo_url.' }, { status: 422 })
  }

  // Marquer en cours dès le début
  await supabaseAdmin
    .from('pack_openings')
    .update({ ocr_status: 'processing' })
    .eq('id', pack_id)

  // ── 2. Télécharger la photo ───────────────────────────────
  console.log('[process-scan] téléchargement :', pack.photo_url)

  const imgRes = await fetch(pack.photo_url as string)
  if (!imgRes.ok) {
    await supabaseAdmin
      .from('pack_openings')
      .update({ ocr_status: 'error' })
      .eq('id', pack_id)
    return NextResponse.json(
      { error: `Impossible de télécharger l'image (HTTP ${imgRes.status}).` },
      { status: 502 }
    )
  }

  const rawBuffer = Buffer.from(await imgRes.arrayBuffer())

  // ── 3. Prétraitement Sharp ────────────────────────────────
  const beforeMeta = await sharp(rawBuffer).metadata()
  console.log(`[process-scan] image originale : ${beforeMeta.width}×${beforeMeta.height} orientation=${beforeMeta.orientation ?? 'none'}`)

  const processedBuffer = await sharp(rawBuffer)
    .rotate()
    .resize(1500, 1500, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer()

  const afterMeta = await sharp(processedBuffer).metadata()
  console.log(`[process-scan] après traitement : ${afterMeta.width}×${afterMeta.height} — ${(processedBuffer.length / 1024).toFixed(1)} Ko`)

  // ── 4a. Vision TEXT_DETECTION pour détecter l'orientation ──
  console.log('[process-scan] détection orientation (TEXT_DETECTION)…')

  let finalBuffer = processedBuffer
  let orientationAngle: number | null = null
  let rotationApplied = 0

  const orientRes = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          image: { content: processedBuffer.toString('base64') },
          features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
        }],
      }),
    }
  )

  if (orientRes.ok) {
    const orientData = await orientRes.json()
    const vertices = orientData.responses?.[0]?.textAnnotations?.[0]?.boundingPoly?.vertices

    if (vertices && vertices.length >= 2) {
      const angle = Math.atan2(
        vertices[1].y - vertices[0].y,
        vertices[1].x - vertices[0].x
      ) * 180 / Math.PI

      orientationAngle = angle
      console.log(`[process-scan] angle détecté : ${angle.toFixed(1)}°`)

      if (angle >= 45 && angle <= 135) {
        // Image pivotée 90° sens horaire → corriger avec 270°
        rotationApplied = 270
        console.log('[process-scan] rotation appliquée : 270° (correction CW 90°)')
        finalBuffer = await sharp(processedBuffer).rotate(270).jpeg({ quality: 85 }).toBuffer()
      } else if (angle >= -135 && angle <= -45) {
        // Image pivotée 90° sens antihoraire → corriger avec 90°
        rotationApplied = 90
        console.log('[process-scan] rotation appliquée : 90° (correction CCW 90°)')
        finalBuffer = await sharp(processedBuffer).rotate(90).jpeg({ quality: 85 }).toBuffer()
      } else {
        console.log('[process-scan] orientation correcte, pas de rotation supplémentaire')
      }
    } else {
      console.log('[process-scan] aucun texte détecté pour l\'orientation, appel DOCUMENT_TEXT_DETECTION direct')
    }
  } else {
    console.warn('[process-scan] TEXT_DETECTION orientation échoué, on continue sans rotation')
  }

  // ── 4b. Google Cloud Vision DOCUMENT_TEXT_DETECTION ──────────
  // On envoie l'image originale non modifiée pour préserver la qualité maximale.
  // Sharp est utilisé uniquement pour la détection d'orientation (appel TEXT_DETECTION ci-dessus).
  console.log(`[process-scan] DOCUMENT_TEXT_DETECTION sur image originale (${(rawBuffer.length / 1024).toFixed(1)} Ko)`)
  const visionRes = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          image: { content: rawBuffer.toString('base64') },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
        }],
      }),
    }
  )

  if (!visionRes.ok) {
    const errText = await visionRes.text()
    console.error('[process-scan] Vision API HTTP error:', errText)
    await supabaseAdmin
      .from('pack_openings')
      .update({ ocr_status: 'error' })
      .eq('id', pack_id)
    return NextResponse.json(
      { error: `Vision API error (HTTP ${visionRes.status}).` },
      { status: 502 }
    )
  }

  const visionData = await visionRes.json()
  const annotation = visionData.responses?.[0]

  if (annotation?.error) {
    console.error('[process-scan] Vision API error:', annotation.error.message)
    await supabaseAdmin
      .from('pack_openings')
      .update({ ocr_status: 'error' })
      .eq('id', pack_id)
    return NextResponse.json({ error: annotation.error.message }, { status: 502 })
  }

  const fullText: string = annotation?.fullTextAnnotation?.text ?? ''
  console.log(`[process-scan] texte brut reçu : ${fullText.length} caractères`)

  // ── 5. Extraction des blocs "kg" + fallback ───────────────
  const allParas = extractParagraphs(annotation)
  console.log(`[process-scan] ${allParas.length} paragraphe(s) extrait(s) au total`)

  const blocs: string[] = []

  for (const para of allParas) {
    if (!/\bkg\b/i.test(para.text)) continue

    const DATE_RE = /\d+[-./]\d+[-./]\d{3,4}/
    const dateMatch = DATE_RE.exec(para.text)
    const nameBeforeDate = dateMatch ? para.text.slice(0, dateMatch.index).trim() : null
    const hasValidName = nameBeforeDate !== null && nameBeforeDate.length >= 3

    if (hasValidName) {
      blocs.push(para.text)
    } else {
      // ── Fallback distance euclidienne ────────────────────────
      const reason = dateMatch
        ? `nom avant date trop court ("${nameBeforeDate}")`
        : 'pas de date dans le bloc'
      console.log(`[process-scan] fallback: ${reason} — topY=${para.topY} cx=${para.cx.toFixed(0)} cy=${para.cy.toFixed(0)} — "${para.text}"`)

      const nearest = fallbackNameBlock(allParas, para)

      if (!nearest) {
        console.log(`[process-scan] fallback: aucun candidat trouvé`)
      } else {
        console.log(`[process-scan] fallback: sélectionné → distance=${nearest.distance.toFixed(1)}px  "${nearest.text}"`)
      }

      // Fusionner le nom fallback avec le bloc kg pour que match-sticker
      // ait le contexte complet (date + poids présents dans le bloc kg)
      blocs.push(nearest ? `${nearest.text} ${para.text}` : para.text)
    }
  }

  console.log(`[process-scan] ── ${blocs.length} BLOC(S) "kg" TROUVÉ(S) ──`)
  blocs.forEach((b, i) => {
    console.log(`[process-scan]   [${i + 1}/${blocs.length}] "${b}"`)
  })
  if (blocs.length === 0) {
    console.log('[process-scan]   (aucun bloc contenant "kg" détecté)')
  }
  console.log('[process-scan] ────────────────────────────────────────')

  // ── 6. Matching des stickers (appel direct, sans HTTP) ───────
  let stickers
  try {
    stickers = await matchStickers(blocs, user_id as string, pack_id as string)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur matching.'
    console.error('[process-scan] matchStickers:', message)
    await supabaseAdmin.from('pack_openings').update({ ocr_status: 'error' }).eq('id', pack_id)
    return NextResponse.json({ error: message }, { status: 500 })
  }

  // ── 7. Mettre à jour ocr_status = 'done' ─────────────────
  const { error: updateErr } = await supabaseAdmin
    .from('pack_openings')
    .update({ ocr_status: 'done' })
    .eq('id', pack_id)

  if (updateErr) {
    console.error('[process-scan] pack_openings update:', updateErr.message)
  }

  // ── 8. Vérification des badges (appel direct, sans HTTP) ──
  let new_badges: unknown[] = []
  try {
    const badgesResult = await checkBadges(user_id as string)
    new_badges = badgesResult.new_badges
  } catch (err) {
    console.error('[process-scan] checkBadges:', err instanceof Error ? err.message : err)
  }

  // ── 9. Réponse ────────────────────────────────────────────
  return NextResponse.json({ stickers, new_badges })
}
