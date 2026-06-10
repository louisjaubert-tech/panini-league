'use server'

import { cookies } from 'next/headers'
import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export type ScanState = {
  error?: string
  pack_id?: string
  user_id?: string
  duplicate?: boolean
  existing_photo_url?: string | null
}

export async function uploadPack(_prev: ScanState, formData: FormData): Promise<ScanState> {
  const cookieStore = await cookies()
  const token = cookieStore.get('sb-access-token')?.value

  if (!token) {
    return { error: 'Non authentifié.' }
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)

  if (authError || !user) {
    return { error: 'Session invalide.' }
  }

  const photoHash = formData.get('photo_hash') as string | null
  const force     = formData.get('force') === 'true'

  const file = formData.get('photo') as File | null

  if (!file || file.size === 0) {
    return { error: 'Aucune photo sélectionnée.' }
  }

  if (!file.type.startsWith('image/')) {
    return { error: 'Le fichier doit être une image.' }
  }

  if (file.size > 10 * 1024 * 1024) {
    return { error: 'La photo ne doit pas dépasser 10 Mo.' }
  }

  // ── Vérification doublon par hash ─────────────────────────────────────────
  if (photoHash && !force) {
    try {
      const { data: existing } = await supabaseAdmin
        .from('pack_openings')
        .select('id, photo_url')
        .eq('user_id', user.id)
        .eq('photo_hash', photoHash)
        .neq('ocr_status', 'cancelled')
        .limit(1)
        .maybeSingle()

      if (existing) {
        return {
          duplicate: true,
          existing_photo_url: existing.photo_url as string | null,
        }
      }
    } catch {
      // En cas d'erreur (colonne absente, etc.) on laisse passer
    }
  }

  const timestamp = Date.now()
  const path = `${user.id}/${timestamp}.jpg`

  const arrayBuffer = await file.arrayBuffer()
  const buffer = new Uint8Array(arrayBuffer)

  const { error: uploadError } = await supabaseAdmin.storage
    .from('pack-photos')
    .upload(path, buffer, { contentType: 'image/jpeg', upsert: false })

  if (uploadError) {
    return { error: `Erreur upload : ${uploadError.message}` }
  }

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from('pack-photos')
    .getPublicUrl(path)

  const { data: pack, error: dbError } = await supabaseAdmin
    .from('pack_openings')
    .insert({ user_id: user.id, photo_url: publicUrl, ocr_status: 'pending', ...(photoHash ? { photo_hash: photoHash } : {}) })
    .select('id')
    .single()

  if (dbError || !pack) {
    return { error: `Erreur base de données : ${dbError?.message}` }
  }

  return { pack_id: pack.id as string, user_id: user.id }
}
