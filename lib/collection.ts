import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Décrémente la quantité d'un sticker dans user_collection.
 * - Si quantity > qty → décrémente de qty
 * - Si quantity <= qty → supprime la ligne
 * Retourne true si l'opération a réussi.
 */
export async function decrementSticker(
  supabaseAdmin: SupabaseClient,
  userId: string,
  stickerId: string,
  qty = 1,
): Promise<boolean> {
  const { data: row, error: fetchErr } = await supabaseAdmin
    .from('user_collection')
    .select('id, quantity')
    .eq('user_id', userId)
    .eq('sticker_id', stickerId)
    .maybeSingle()

  if (fetchErr) {
    console.error(`[decrementSticker] fetch ÉCHEC sticker_id=${stickerId}:`, fetchErr.message)
    return false
  }

  if (!row) {
    // Pas dans la collection — rien à faire
    return true
  }

  if ((row.quantity as number) > qty) {
    const { error: updateErr } = await supabaseAdmin
      .from('user_collection')
      .update({ quantity: (row.quantity as number) - qty })
      .eq('id', row.id)

    if (updateErr) {
      console.error(`[decrementSticker] update ÉCHEC sticker_id=${stickerId}:`, updateErr.message)
      return false
    }
  } else {
    const { error: deleteErr } = await supabaseAdmin
      .from('user_collection')
      .delete()
      .eq('id', row.id)

    if (deleteErr) {
      console.error(`[decrementSticker] delete ÉCHEC sticker_id=${stickerId}:`, deleteErr.message)
      return false
    }
  }

  return true
}
