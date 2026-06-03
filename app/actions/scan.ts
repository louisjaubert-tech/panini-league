'use server'

import { cookies } from 'next/headers'
import { supabase, supabaseAdmin } from '@/lib/supabase'

export type ScanState = {
  error?: string
  success?: boolean
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

  const { error: dbError } = await supabaseAdmin
    .from('pack_openings')
    .insert({ user_id: user.id, photo_url: publicUrl, ocr_status: 'pending' })

  if (dbError) {
    return { error: `Erreur base de données : ${dbError.message}` }
  }

  return { success: true }
}
