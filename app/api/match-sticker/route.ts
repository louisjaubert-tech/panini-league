import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// ════════════════════════════════════════════════════════════
// Levenshtein + similarité (pur JS)
// ════════════════════════════════════════════════════════════

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    const curr: number[] = [i]
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    prev = curr
  }
  return prev[n]
}

function similarity(a: string, b: string): number {
  if (!a && !b) return 1
  if (!a || !b) return 0
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length)
}

// ════════════════════════════════════════════════════════════
// Normalisation
// ════════════════════════════════════════════════════════════

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')        // supprimer les diacritiques (catégorie Unicode Mn)
    .replace(/[^a-z\s]/g, '')       // garder uniquement lettres et espaces
    .replace(/\s+/g, ' ')
    .trim()
}

// ════════════════════════════════════════════════════════════
// Extraction du nom depuis un bloc OCR
// ════════════════════════════════════════════════════════════

const DATE_RE = /\d{1,2}[-./]\d{1,2}[-./]\d{4}/

function extractName(block: string): string {
  const match = DATE_RE.exec(block)
  if (match) {
    return block.slice(0, match.index).trim()
  }
  return block.trim()
}

// ════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════

type StickerRef = {
  sticker_id: string
  display_name: string
  normalized_name: string
}

type MatchResult = {
  sticker_id: string | null
  display_name: string | null
  confidence: number
  pass: 1 | 2 | 3 | 4 | null
}

// ════════════════════════════════════════════════════════════
// Matching 4 passes
// ════════════════════════════════════════════════════════════

const THRESH_PASS2 = 0.85
const THRESH_PASS3 = 0.75
const THRESH_PASS4 = 0.80

function matchSticker(rawName: string, refs: StickerRef[]): MatchResult {
  const normName = normalize(rawName)

  // Passe 1 : exact sur normalized_name
  const exact = refs.find(r => normalize(r.normalized_name) === normName)
  if (exact) {
    return { sticker_id: exact.sticker_id, display_name: exact.display_name, confidence: 1.0, pass: 1 }
  }

  // Passe 2 : Levenshtein nom complet
  let best2: StickerRef | null = null, score2 = 0
  for (const r of refs) {
    const s = similarity(normName, normalize(r.normalized_name))
    if (s > score2) { score2 = s; best2 = r }
  }
  if (score2 >= THRESH_PASS2) {
    return { sticker_id: best2!.sticker_id, display_name: best2!.display_name, confidence: score2, pass: 2 }
  }

  // Passe 3 : prénom × 0.4 + nom × 0.6
  const words = normName.split(' ').filter(Boolean)
  const lastName3  = words[words.length - 1] ?? ''
  const firstName3 = words.slice(0, -1).join(' ')

  let best3: StickerRef | null = null, score3 = 0
  for (const r of refs) {
    const rNorm   = normalize(r.normalized_name)
    const rWords  = rNorm.split(' ').filter(Boolean)
    const rLast   = rWords[rWords.length - 1] ?? ''
    const rFirst  = rWords.slice(0, -1).join(' ')
    const s = similarity(lastName3, rLast) * 0.6
            + (firstName3 && rFirst ? similarity(firstName3, rFirst) * 0.4 : 0)
    if (s > score3) { score3 = s; best3 = r }
  }
  if (score3 >= THRESH_PASS3) {
    return { sticker_id: best3!.sticker_id, display_name: best3!.display_name, confidence: score3, pass: 3 }
  }

  // Passe 4 : dernier mot seul, un seul candidat
  const lastWord = normName.split(' ').filter(Boolean).at(-1) ?? ''
  const candidates4 = refs
    .map(r => {
      const rLast = normalize(r.normalized_name).split(' ').filter(Boolean).at(-1) ?? ''
      return { ref: r, score: similarity(lastWord, rLast) }
    })
    .filter(c => c.score >= THRESH_PASS4)

  if (candidates4.length === 1) {
    const { ref, score } = candidates4[0]
    return { sticker_id: ref.sticker_id, display_name: ref.display_name, confidence: score, pass: 4 }
  }

  return { sticker_id: null, display_name: null, confidence: score2, pass: null }
}

// ════════════════════════════════════════════════════════════
// POST handler
// ════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  // ── Validation de la requête ──────────────────────────────
  let body: { blocs?: unknown; user_id?: unknown; pack_id?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide.' }, { status: 400 })
  }

  const { blocs, user_id, pack_id } = body

  if (!Array.isArray(blocs) || blocs.length === 0) {
    return NextResponse.json({ error: '`blocs` doit être un tableau non vide de strings.' }, { status: 400 })
  }
  if (typeof user_id !== 'string' || !user_id) {
    return NextResponse.json({ error: '`user_id` manquant.' }, { status: 400 })
  }
  if (typeof pack_id !== 'string' || !pack_id) {
    return NextResponse.json({ error: '`pack_id` manquant.' }, { status: 400 })
  }
  if (blocs.some(b => typeof b !== 'string')) {
    return NextResponse.json({ error: 'Tous les éléments de `blocs` doivent être des strings.' }, { status: 400 })
  }

  // ── Chargement stickers_reference (une seule fois) ────────
  const { data: refs, error: refsError } = await supabaseAdmin
    .from('stickers_reference')
    .select('sticker_id, display_name, normalized_name')

  if (refsError) {
    console.error('[match-sticker] stickers_reference:', refsError.message)
    return NextResponse.json({ error: 'Impossible de charger la référence.' }, { status: 500 })
  }

  const stickerRefs = refs as StickerRef[]

  // ── Charger la collection actuelle de l'user (pour détection doublons) ──
  const { data: userCollection } = await supabaseAdmin
    .from('user_collection')
    .select('sticker_id')
    .eq('user_id', user_id)

  const ownedIds = new Set((userCollection ?? []).map(r => r.sticker_id as string))

  // ── Traiter chaque bloc ───────────────────────────────────
  type ResultRow = {
    sticker_id: string | null
    display_name: string | null
    confidence: number
    status: 'matched' | 'needs_review' | 'unmatched'
    is_duplicate: boolean
    insert_error?: string
  }

  const results: ResultRow[] = []

  for (const bloc of blocs as string[]) {
    const rawName = extractName(bloc)
    const { sticker_id, display_name, confidence } = matchSticker(rawName, stickerRefs)

    let status: ResultRow['status']
    let is_duplicate = false

    if (confidence >= 0.85 && sticker_id) {
      status = 'matched'
      is_duplicate = ownedIds.has(sticker_id)
    } else if (confidence >= 0.70 && sticker_id) {
      status = 'needs_review'
    } else {
      status = 'unmatched'
    }

    // ── Insérer dans scanned_stickers ─────────────────────
    const insertPayload = {
      pack_id,
      user_id,
      sticker_id:   status !== 'unmatched' ? sticker_id : null,
      is_duplicate: status === 'matched' ? is_duplicate : false,
      confidence,
    }

    console.log('[match-sticker] insert scanned_stickers →', JSON.stringify(insertPayload))

    const { data: scanData, error: scanErr } = await supabaseAdmin
      .from('scanned_stickers')
      .insert(insertPayload)
      .select()

    if (scanErr) {
      console.error('[match-sticker] scanned_stickers insert FAILED:', {
        message: scanErr.message,
        details: scanErr.details,
        hint:    scanErr.hint,
        code:    scanErr.code,
      })
    } else {
      console.log('[match-sticker] scanned_stickers insert OK →', JSON.stringify(scanData))
    }

    // ── Upsert user_collection si confiance >= 0.85 ───────
    if (status === 'matched' && sticker_id) {
      if (is_duplicate) {
        // Incrémenter la quantité existante
        const { data: existing } = await supabaseAdmin
          .from('user_collection')
          .select('id, quantity')
          .eq('user_id', user_id)
          .eq('sticker_id', sticker_id)
          .single()

        if (existing) {
          await supabaseAdmin
            .from('user_collection')
            .update({ quantity: (existing.quantity as number) + 1 })
            .eq('id', existing.id)
        }
      } else {
        // Nouvelle carte → insérer + marquer comme owned pour les blocs suivants
        await supabaseAdmin
          .from('user_collection')
          .insert({ user_id, sticker_id, quantity: 1, first_obtained_at: new Date().toISOString() })

        ownedIds.add(sticker_id)
      }
    }

    results.push({
      sticker_id,
      display_name,
      confidence,
      status,
      is_duplicate,
      ...(scanErr ? { insert_error: `${scanErr.code}: ${scanErr.message}${scanErr.details ? ` — ${scanErr.details}` : ''}` } : {}),
    })
  }

  return NextResponse.json(results)
}
