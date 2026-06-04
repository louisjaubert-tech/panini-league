import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// ════════════════════════════════════════════════════════════
// Helpers Vision — extraction des paragraphes avec coordonnées
// ════════════════════════════════════════════════════════════

type Para = { text: string; topY: number }

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

function topYOf(vertices: Array<{ x?: number; y?: number }> = []): number {
  return Math.min(...vertices.map(v => v.y ?? 0))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractParagraphs(annotation: any): Para[] {
  const paras: Para[] = []
  for (const page of annotation?.fullTextAnnotation?.pages ?? []) {
    for (const block of page.blocks ?? []) {
      for (const para of block.paragraphs ?? []) {
        const text = paragraphText(para)
        if (!text) continue
        paras.push({ text, topY: topYOf(para.boundingBox?.vertices) })
      }
    }
  }
  return paras
}

/** Retourne le texte du bloc le plus proche au-dessus d'un bloc "kg", sans bruit. */
function fallbackNameBlock(allParas: Para[], kgTopY: number): string | null {
  const NOISE_RE = /\bkg\b|pani\b|panini|fifa|\d+[-./]\d+[-./]\d{3,4}/i
  const candidates = allParas
    .filter(p => p.topY < kgTopY && !NOISE_RE.test(p.text))
    .sort((a, b) => b.topY - a.topY)
  return candidates[0]?.text ?? null
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
  const visionRes = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          image: { content: finalBuffer.toString('base64') },
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
  console.log(`[process-scan] ── TEXTE BRUT VISION (${fullText.length} caractères) ──`)
  console.log(fullText.trim() || '(vide)')
  console.log('[process-scan] ────────────────────────────────────────')

  // ── 5. Extraction des blocs "kg" + fallback ───────────────
  const allParas = extractParagraphs(annotation)
  console.log(`[process-scan] ── TOUS LES PARAGRAPHES (${allParas.length}) triés par topY ──`)
  ;[...allParas]
    .sort((a, b) => a.topY - b.topY)
    .forEach((p, i) => {
      const hasKg = /\bkg\b/i.test(p.text)
      console.log(`[process-scan]   [${String(i).padStart(2)}] topY=${String(p.topY).padStart(4)}${hasKg ? ' ◀KG' : '    '}  "${p.text}"`)
    })
  console.log('[process-scan] ─────────────────────────────────────────')

  const blocs: string[] = []

  for (const para of allParas) {
    if (!/\bkg\b/i.test(para.text)) continue

    // Extraire le nom avant la première date (s'il y en a une)
    const DATE_RE = /\d+[-./]\d+[-./]\d{3,4}/
    const TEST_BLOC = '38-7-2002 | 181 m | 81 kg'
    console.log(`[process-scan] DATE_RE pattern : ${DATE_RE}`)
    console.log(`[process-scan] DATE_RE.test("${TEST_BLOC}") → ${DATE_RE.test(TEST_BLOC)}`)
    const dateMatch = DATE_RE.exec(para.text)
    const nameBeforeDate = dateMatch ? para.text.slice(0, dateMatch.index).trim() : null
    const hasValidName = nameBeforeDate !== null && nameBeforeDate.length >= 3

    if (hasValidName) {
      blocs.push(para.text)
    } else {
      // ── Fallback : nom absent ou trop court avant la date ───
      const reason = dateMatch
        ? `nom avant date trop court ("${nameBeforeDate}")`
        : 'pas de date dans le bloc'
      console.log(`[process-scan] fallback: ${reason} — topY=${para.topY} — "${para.text}"`)

      const NOISE_RE = /\bkg\b|pani\b|panini|fifa|\d+[-./]\d+[-./]\d{3,4}/i
      const candidates = allParas
        .filter(p => p.topY < para.topY && !NOISE_RE.test(p.text))
        .sort((a, b) => b.topY - a.topY)

      if (candidates.length === 0) {
        console.log(`[process-scan] fallback: aucun candidat trouvé au-dessus`)
      } else {
        console.log(`[process-scan] fallback: ${candidates.length} candidat(s) :`)
        candidates.forEach((c, i) =>
          console.log(`[process-scan]   [${i}] topY=${c.topY}  "${c.text}"`)
        )
        console.log(`[process-scan] fallback: sélectionné → topY=${candidates[0].topY}  "${candidates[0].text}"`)
      }

      const fallback = candidates[0]?.text ?? null
      // Fusionner le nom fallback avec le bloc kg pour que match-sticker
      // ait le contexte complet (date + poids présents dans le bloc kg)
      blocs.push(fallback ? `${fallback} ${para.text}` : para.text)
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

  // ── 6. Appeler /api/match-sticker ─────────────────────────
  const origin = new URL(request.url).origin

  const matchRes = await fetch(`${origin}/api/match-sticker`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocs, user_id, pack_id }),
  })

  if (!matchRes.ok) {
    const errText = await matchRes.text()
    console.error('[process-scan] match-sticker error:', errText)
    await supabaseAdmin
      .from('pack_openings')
      .update({ ocr_status: 'error' })
      .eq('id', pack_id)
    return NextResponse.json(
      { error: `match-sticker a échoué (HTTP ${matchRes.status}).` },
      { status: 502 }
    )
  }

  const stickers = await matchRes.json()

  // ── 7. Mettre à jour ocr_status = 'done' ─────────────────
  const { error: updateErr } = await supabaseAdmin
    .from('pack_openings')
    .update({ ocr_status: 'done' })
    .eq('id', pack_id)

  if (updateErr) {
    console.error('[process-scan] pack_openings update:', updateErr.message)
  }

  // ── 8. Appeler /api/check-badges ──────────────────────────
  let new_badges: unknown[] = []

  const badgesRes = await fetch(`${origin}/api/check-badges`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id }),
  })

  if (badgesRes.ok) {
    const badgesData = await badgesRes.json()
    new_badges = badgesData.new_badges ?? []
  } else {
    console.error('[process-scan] check-badges error:', badgesRes.status)
  }

  // ── 9. Réponse ────────────────────────────────────────────
  return NextResponse.json({ stickers, new_badges })
}
