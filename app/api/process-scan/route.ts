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
  const NOISE_RE = /\bkg\b|panini|fifa|\d{1,2}[-./]\d{1,2}[-./]\d{4}/i
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

  // ── 4. Google Cloud Vision ────────────────────────────────
  const visionRes = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          image: { content: processedBuffer.toString('base64') },
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
  console.log(`[process-scan] ${allParas.length} paragraphe(s) extrait(s) au total`)

  const blocs: string[] = []

  for (const para of allParas) {
    if (!/\bkg\b/i.test(para.text)) continue

    const hasDate = /\d{1,2}[-./]\d{1,2}[-./]\d{4}/.test(para.text)

    if (hasDate) {
      blocs.push(para.text)
    } else {
      // ── Fallback debug ──────────────────────────────────────
      console.log(`[process-scan] fallback: bloc kg sans date — topY=${para.topY} — "${para.text}"`)

      const NOISE_RE = /\bkg\b|panini|fifa|\d{1,2}[-./]\d{1,2}[-./]\d{4}/i
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
