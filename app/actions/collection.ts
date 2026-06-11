'use server'

import { cookies } from 'next/headers'
import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { checkBadges, checkLeagueTrophies, type NewBadge, type NewTrophy } from '@/lib/checkBadges'
import { decrementSticker } from '@/lib/collection'

export type AddStickerResult =
  | { success: true; quantity: number; new_badges: NewBadge[]; new_trophies: NewTrophy[] }
  | { error: string }

export type RemoveStickerResult =
  | { success: true; quantity: number }
  | { error: string }

export async function addSticker(stickerId: string, qty = 1): Promise<AddStickerResult> {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const cookieStore = await cookies()
  const token = cookieStore.get('sb-access-token')?.value
  if (!token) return { error: 'Non authentifié.' }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return { error: 'Session invalide.' }

  const userId = user.id
  const delta = Math.max(1, Math.floor(qty))

  // ── Upsert dans user_collection ─────────────────────────────────────────────
  const { data: existing } = await supabaseAdmin
    .from('user_collection')
    .select('id, quantity')
    .eq('user_id', userId)
    .eq('sticker_id', stickerId)
    .maybeSingle()

  let newQuantity: number

  if (existing) {
    newQuantity = (existing.quantity as number) + delta
    const { error } = await supabaseAdmin
      .from('user_collection')
      .update({ quantity: newQuantity })
      .eq('id', existing.id)
    if (error) return { error: `Erreur mise à jour : ${error.message}` }
  } else {
    newQuantity = delta
    const { error } = await supabaseAdmin
      .from('user_collection')
      .insert({ user_id: userId, sticker_id: stickerId, quantity: delta, first_obtained_at: new Date().toISOString() })
    if (error) return { error: `Erreur ajout : ${error.message}` }
  }

  // ── Badges ──────────────────────────────────────────────────────────────────
  let new_badges: NewBadge[] = []
  try {
    const result = await checkBadges(userId)
    new_badges = result.new_badges
  } catch (err) {
    console.error('[addSticker] checkBadges:', err)
  }

  // ── Trophées de ligue ───────────────────────────────────────────────────────
  let new_trophies: NewTrophy[] = []
  try {
    const { data: memberships } = await supabaseAdmin
      .from('league_members')
      .select('league_id')
      .eq('user_id', userId)

    const leagueIds = (memberships ?? []).map((m) => m.league_id as string)
    const trophyResults = await Promise.all(
      leagueIds.map((leagueId) => checkLeagueTrophies(userId, leagueId))
    )
    new_trophies = trophyResults.flat()
  } catch (err) {
    console.error('[addSticker] checkLeagueTrophies:', err)
  }

  return { success: true, quantity: newQuantity, new_badges, new_trophies }
}

export async function removeSticker(stickerId: string): Promise<RemoveStickerResult> {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const cookieStore = await cookies()
  const token = cookieStore.get('sb-access-token')?.value
  if (!token) return { error: 'Non authentifié.' }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return { error: 'Session invalide.' }

  const userId = user.id

  // Lire la quantité actuelle avant décrémentation
  const { data: existing } = await supabaseAdmin
    .from('user_collection')
    .select('quantity')
    .eq('user_id', userId)
    .eq('sticker_id', stickerId)
    .maybeSingle()

  if (!existing) return { error: 'Sticker non trouvé dans ta collection.' }

  const ok = await decrementSticker(supabaseAdmin, userId, stickerId)
  if (!ok) return { error: 'Erreur lors du retrait.' }

  const newQuantity = Math.max(0, (existing.quantity as number) - 1)
  return { success: true, quantity: newQuantity }
}
