import { supabaseAdmin } from '@/lib/supabaseAdmin'

// ════════════════════════════════════════════════════════════
// Levenshtein + similarité
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
  const step1 = str
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  const digitIdx = step1.search(/\d/)
  const nameOnly = digitIdx !== -1 ? step1.slice(0, digitIdx).trim() : step1

  return nameOnly
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// ════════════════════════════════════════════════════════════
// Extraction du nom depuis un bloc OCR
// ════════════════════════════════════════════════════════════

const DATE_RE = /\d{1,2}[-./]\d{1,2}[-./]\d{4}/

function extractName(block: string): string {
  const match = DATE_RE.exec(block)
  return match ? block.slice(0, match.index).trim() : block.trim()
}

// ════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════

type StickerRef = {
  sticker_id: string
  display_name: string
  normalized_name: string
}

export type StickerResultRow = {
  sticker_id: string | null
  display_name: string | null
  confidence: number
  status: 'matched' | 'needs_review' | 'unmatched'
  is_duplicate: boolean
  insert_error?: string
}

// ════════════════════════════════════════════════════════════
// Matching 4 passes
// ════════════════════════════════════════════════════════════

const THRESH_PASS2 = 0.85
const THRESH_PASS3 = 0.75
const THRESH_PASS4 = 0.80

function matchOne(rawName: string, refs: StickerRef[]): {
  sticker_id: string | null
  display_name: string | null
  confidence: number
} {
  const normName = normalize(rawName)

  const exact = refs.find(r => normalize(r.normalized_name) === normName)
  if (exact) return { sticker_id: exact.sticker_id, display_name: exact.display_name, confidence: 1.0 }

  let best2: StickerRef | null = null, score2 = 0
  for (const r of refs) {
    const s = similarity(normName, normalize(r.normalized_name))
    if (s > score2) { score2 = s; best2 = r }
  }
  if (score2 >= THRESH_PASS2) return { sticker_id: best2!.sticker_id, display_name: best2!.display_name, confidence: score2 }

  const words = normName.split(' ').filter(Boolean)
  const lastName3  = words[words.length - 1] ?? ''
  const firstName3 = words.slice(0, -1).join(' ')

  let best3: StickerRef | null = null, score3 = 0
  for (const r of refs) {
    const rNorm  = normalize(r.normalized_name)
    const rWords = rNorm.split(' ').filter(Boolean)
    const rLast  = rWords[rWords.length - 1] ?? ''
    const rFirst = rWords.slice(0, -1).join(' ')
    const s = similarity(lastName3, rLast) * 0.6
            + (firstName3 && rFirst ? similarity(firstName3, rFirst) * 0.4 : 0)
    if (s > score3) { score3 = s; best3 = r }
  }
  if (score3 >= THRESH_PASS3) return { sticker_id: best3!.sticker_id, display_name: best3!.display_name, confidence: score3 }

  const lastWord = normName.split(' ').filter(Boolean).at(-1) ?? ''
  const candidates4 = refs
    .map(r => ({
      ref: r,
      score: similarity(lastWord, normalize(r.normalized_name).split(' ').filter(Boolean).at(-1) ?? ''),
    }))
    .filter(c => c.score >= THRESH_PASS4)

  if (candidates4.length === 1) {
    const { ref, score } = candidates4[0]
    return { sticker_id: ref.sticker_id, display_name: ref.display_name, confidence: score }
  }

  return { sticker_id: null, display_name: null, confidence: score2 }
}

// ════════════════════════════════════════════════════════════
// Fonction principale exportée
// ════════════════════════════════════════════════════════════

export async function matchStickers(
  blocs: string[],
  userId: string,
  packId: string,
): Promise<StickerResultRow[]> {
  const { data: refs, error: refsError } = await supabaseAdmin
    .from('stickers_reference')
    .select('sticker_id, display_name, normalized_name')

  if (refsError) {
    console.error('[matchStickers] stickers_reference:', refsError.message)
    throw new Error('Impossible de charger la référence.')
  }

  const stickerRefs = refs as StickerRef[]

  const { data: userCollection } = await supabaseAdmin
    .from('user_collection')
    .select('sticker_id')
    .eq('user_id', userId)

  const ownedIds = new Set((userCollection ?? []).map(r => r.sticker_id as string))

  const results: StickerResultRow[] = []

  for (const bloc of blocs) {
    const rawName = extractName(bloc)
    const { sticker_id, display_name, confidence } = matchOne(rawName, stickerRefs)

    let status: StickerResultRow['status']
    let is_duplicate = false

    if (confidence >= 0.85 && sticker_id) {
      status = 'matched'
      is_duplicate = ownedIds.has(sticker_id)
    } else if (confidence >= 0.70 && sticker_id) {
      status = 'needs_review'
    } else {
      status = 'unmatched'
    }

    const insertPayload = {
      pack_id: packId,
      user_id: userId,
      sticker_id:   status !== 'unmatched' ? sticker_id : null,
      is_duplicate: status === 'matched' ? is_duplicate : false,
      confidence,
    }

    console.log('[matchStickers] insert scanned_stickers →', JSON.stringify(insertPayload))

    const { data: scanData, error: scanErr } = await supabaseAdmin
      .from('scanned_stickers')
      .insert(insertPayload)
      .select()

    if (scanErr) {
      console.error('[matchStickers] scanned_stickers insert FAILED:', {
        message: scanErr.message,
        details: scanErr.details,
        hint:    scanErr.hint,
        code:    scanErr.code,
      })
    } else {
      console.log('[matchStickers] scanned_stickers insert OK →', JSON.stringify(scanData))
    }

    if (status === 'matched' && sticker_id) {
      if (is_duplicate) {
        const { data: existing } = await supabaseAdmin
          .from('user_collection')
          .select('id, quantity')
          .eq('user_id', userId)
          .eq('sticker_id', sticker_id)
          .single()

        if (existing) {
          await supabaseAdmin
            .from('user_collection')
            .update({ quantity: (existing.quantity as number) + 1 })
            .eq('id', existing.id)
        }
      } else {
        await supabaseAdmin
          .from('user_collection')
          .insert({ user_id: userId, sticker_id, quantity: 1, first_obtained_at: new Date().toISOString() })
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

  return results
}
