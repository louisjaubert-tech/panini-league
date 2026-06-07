'use server'

import { cookies } from 'next/headers'
import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// ── Helper auth ───────────────────────────────────────────────────────────────

async function getAuthUserId(): Promise<string | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('sb-access-token')?.value
  if (!token) return null

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return user.id
}

// ── Types publics ─────────────────────────────────────────────────────────────

export type StickerEntry = {
  sticker_id: string
  display_name: string
  quantity: number
}

export type LeagueMember = {
  id: string
  username: string
  collection: StickerEntry[]
}

export type ExchangeData = {
  currentUserId: string
  members: LeagueMember[]
}

// ── getExchangeData ───────────────────────────────────────────────────────────

export async function getExchangeData(
  leagueId: string,
): Promise<ExchangeData | { error: string }> {
  const currentUserId = await getAuthUserId()
  if (!currentUserId) return { error: 'Non authentifié.' }

  // 1. Membres de la ligue avec leur profil
  const { data: memberRows, error: membersErr } = await supabaseAdmin
    .from('league_members')
    .select('user_id, profiles(id, username)')
    .eq('league_id', leagueId)

  if (membersErr) {
    console.error('[trades] getExchangeData league_members:', membersErr.message)
    return { error: membersErr.message }
  }

  const memberIds = (memberRows ?? []).map((m) => m.user_id as string)

  if (memberIds.length === 0) return { currentUserId, members: [] }

  // Vérifier que le current user est bien membre
  if (!memberIds.includes(currentUserId)) {
    return { error: 'Tu n\'es pas membre de cette ligue.' }
  }

  // 2. Collections de tous les membres (avec display_name depuis stickers_reference)
  const { data: collectionRows, error: collectionErr } = await supabaseAdmin
    .from('user_collection')
    .select('user_id, sticker_id, quantity, stickers_reference(sticker_id, display_name)')
    .in('user_id', memberIds)

  if (collectionErr) {
    console.error('[trades] getExchangeData user_collection:', collectionErr.message)
    return { error: collectionErr.message }
  }

  // 3. Construire un index user_id → StickerEntry[]
  const collectionByUser = new Map<string, StickerEntry[]>()

  for (const row of collectionRows ?? []) {
    const uid = row.user_id as string
    const raw = Array.isArray(row.stickers_reference)
      ? row.stickers_reference[0]
      : row.stickers_reference
    const ref = raw as { sticker_id: string; display_name: string } | null

    if (!collectionByUser.has(uid)) collectionByUser.set(uid, [])
    collectionByUser.get(uid)!.push({
      sticker_id: row.sticker_id as string,
      display_name: ref?.display_name ?? (row.sticker_id as string),
      quantity: (row.quantity as number | null) ?? 1,
    })
  }

  // 4. Assembler les membres dans l'ordre (current user en premier)
  const buildMember = (uid: string): LeagueMember => {
    const raw = memberRows?.find((m) => m.user_id === uid)
    const profileRaw = raw?.profiles
    const profile = (
      Array.isArray(profileRaw) ? profileRaw[0] : profileRaw
    ) as { id: string; username: string } | null

    return {
      id: uid,
      username: profile?.username ?? 'Joueur',
      collection: (collectionByUser.get(uid) ?? []).sort((a, b) =>
        a.display_name.localeCompare(b.display_name),
      ),
    }
  }

  const members: LeagueMember[] = [
    buildMember(currentUserId),
    ...memberIds
      .filter((id) => id !== currentUserId)
      .map(buildMember),
  ]

  return { currentUserId, members }
}

// ── confirmReception ──────────────────────────────────────────────────────────

export type Donation = {
  giverId: string
  stickerId: string
}

export async function confirmReception(
  donations: Donation[],
): Promise<{ success: true } | { error: string }> {
  const receiverId = await getAuthUserId()
  if (!receiverId) return { error: 'Non authentifié.' }

  if (!donations || donations.length === 0) return { success: true }

  for (const { giverId, stickerId } of donations) {
    // ── Côté donneur : quantity - 1 (ou suppression si quantity = 1) ──────────
    const { data: giverRow, error: fetchErr } = await supabaseAdmin
      .from('user_collection')
      .select('quantity')
      .eq('user_id', giverId)
      .eq('sticker_id', stickerId)
      .maybeSingle()

    if (fetchErr) {
      console.error('[trades] confirmReception fetch giver row:', fetchErr.message)
      return { error: fetchErr.message }
    }

    if (giverRow) {
      const currentQty = (giverRow.quantity as number | null) ?? 1

      if (currentQty <= 1) {
        // Supprimer la ligne
        const { error: deleteErr } = await supabaseAdmin
          .from('user_collection')
          .delete()
          .eq('user_id', giverId)
          .eq('sticker_id', stickerId)

        if (deleteErr) {
          console.error('[trades] confirmReception delete giver row:', deleteErr.message)
          return { error: deleteErr.message }
        }
      } else {
        // Décrémenter
        const { error: updateErr } = await supabaseAdmin
          .from('user_collection')
          .update({ quantity: currentQty - 1 })
          .eq('user_id', giverId)
          .eq('sticker_id', stickerId)

        if (updateErr) {
          console.error('[trades] confirmReception decrement giver:', updateErr.message)
          return { error: updateErr.message }
        }
      }
    }

    // ── Côté receveur : quantity + 1 ou insertion ─────────────────────────────
    const { data: receiverRow, error: fetchReceiverErr } = await supabaseAdmin
      .from('user_collection')
      .select('quantity')
      .eq('user_id', receiverId)
      .eq('sticker_id', stickerId)
      .maybeSingle()

    if (fetchReceiverErr) {
      console.error('[trades] confirmReception fetch receiver row:', fetchReceiverErr.message)
      return { error: fetchReceiverErr.message }
    }

    if (receiverRow) {
      const currentQty = (receiverRow.quantity as number | null) ?? 1
      const { error: updateErr } = await supabaseAdmin
        .from('user_collection')
        .update({ quantity: currentQty + 1 })
        .eq('user_id', receiverId)
        .eq('sticker_id', stickerId)

      if (updateErr) {
        console.error('[trades] confirmReception increment receiver:', updateErr.message)
        return { error: updateErr.message }
      }
    } else {
      const { error: insertErr } = await supabaseAdmin
        .from('user_collection')
        .insert({ user_id: receiverId, sticker_id: stickerId, quantity: 1 })

      if (insertErr) {
        console.error('[trades] confirmReception insert receiver:', insertErr.message)
        return { error: insertErr.message }
      }
    }
  }

  return { success: true }
}

// ── confirmDonation ───────────────────────────────────────────────────────────
// Appelée par le DONNEUR pour confirmer qu'il a physiquement remis des stickers.
// giverId = current user (cookie), receiverId est passé explicitement.

export type DonationOut = {
  stickerId: string
  receiverId: string
}

export async function confirmDonation(
  donations: DonationOut[],
): Promise<{ success: true } | { error: string }> {
  const giverId = await getAuthUserId()
  if (!giverId) return { error: 'Non authentifié.' }

  if (!donations || donations.length === 0) return { success: true }

  // Réutilise la même logique que confirmReception mais avec les rôles inversés
  const mapped: Donation[] = donations.map(({ stickerId, receiverId }) => ({
    giverId,
    stickerId,
    // On passe receiverId dans la liste pour traitement séquentiel ci-dessous
    _receiverId: receiverId,
  })) as (Donation & { _receiverId: string })[]

  for (const item of mapped) {
    const { giverId: giver, stickerId } = item
    const receiverId = (item as unknown as { _receiverId: string })._receiverId

    // ── Côté donneur ──────────────────────────────────────────────────────────
    const { data: giverRow, error: fetchErr } = await supabaseAdmin
      .from('user_collection')
      .select('quantity')
      .eq('user_id', giver)
      .eq('sticker_id', stickerId)
      .maybeSingle()

    if (fetchErr) {
      console.error('[trades] confirmDonation fetch giver row:', fetchErr.message)
      return { error: fetchErr.message }
    }

    if (giverRow) {
      const currentQty = (giverRow.quantity as number | null) ?? 1
      if (currentQty <= 1) {
        const { error: deleteErr } = await supabaseAdmin
          .from('user_collection')
          .delete()
          .eq('user_id', giver)
          .eq('sticker_id', stickerId)
        if (deleteErr) {
          console.error('[trades] confirmDonation delete giver row:', deleteErr.message)
          return { error: deleteErr.message }
        }
      } else {
        const { error: updateErr } = await supabaseAdmin
          .from('user_collection')
          .update({ quantity: currentQty - 1 })
          .eq('user_id', giver)
          .eq('sticker_id', stickerId)
        if (updateErr) {
          console.error('[trades] confirmDonation decrement giver:', updateErr.message)
          return { error: updateErr.message }
        }
      }
    }

    // ── Côté receveur ─────────────────────────────────────────────────────────
    const { data: receiverRow, error: fetchReceiverErr } = await supabaseAdmin
      .from('user_collection')
      .select('quantity')
      .eq('user_id', receiverId)
      .eq('sticker_id', stickerId)
      .maybeSingle()

    if (fetchReceiverErr) {
      console.error('[trades] confirmDonation fetch receiver row:', fetchReceiverErr.message)
      return { error: fetchReceiverErr.message }
    }

    if (receiverRow) {
      const currentQty = (receiverRow.quantity as number | null) ?? 1
      const { error: updateErr } = await supabaseAdmin
        .from('user_collection')
        .update({ quantity: currentQty + 1 })
        .eq('user_id', receiverId)
        .eq('sticker_id', stickerId)
      if (updateErr) {
        console.error('[trades] confirmDonation increment receiver:', updateErr.message)
        return { error: updateErr.message }
      }
    } else {
      const { error: insertErr } = await supabaseAdmin
        .from('user_collection')
        .insert({ user_id: receiverId, sticker_id: stickerId, quantity: 1 })
      if (insertErr) {
        console.error('[trades] confirmDonation insert receiver:', insertErr.message)
        return { error: insertErr.message }
      }
    }
  }

  return { success: true }
}
