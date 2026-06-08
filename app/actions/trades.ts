'use server'

import { cookies } from 'next/headers'
import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { checkBadges, checkLeagueTrophies, type NewBadge, type NewTrophy } from '@/lib/checkBadges'

// ── Helper auth ───────────────────────────────────────────────────────────────

async function getAuthUserId(): Promise<string | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('sb-access-token')?.value
  if (!token) return null

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return user.id
}

// ── Helper : badges + trophées pour un utilisateur ───────────────────────────

async function runChecksForUser(userId: string): Promise<{ new_badges: NewBadge[]; new_trophies: NewTrophy[] }> {
  try {
    const [badgesResult, memberships] = await Promise.all([
      checkBadges(userId),
      supabaseAdmin.from('league_members').select('league_id').eq('user_id', userId),
    ])

    const leagueIds = (memberships.data ?? []).map((m) => m.league_id as string)
    const trophyResults = await Promise.all(
      leagueIds.map((lid) => checkLeagueTrophies(userId, lid)),
    )

    return {
      new_badges: badgesResult.new_badges,
      new_trophies: trophyResults.flat(),
    }
  } catch (err) {
    console.error('[trades] runChecksForUser:', err instanceof Error ? err.message : err)
    return { new_badges: [], new_trophies: [] }
  }
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

export type TradeSuccess = {
  success: true
  new_badges: NewBadge[]
  new_trophies: NewTrophy[]
}

// ── getExchangeData ───────────────────────────────────────────────────────────

export async function getExchangeData(
  leagueId: string,
): Promise<ExchangeData | { error: string }> {
  const currentUserId = await getAuthUserId()
  if (!currentUserId) return { error: 'Non authentifié.' }

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

  if (!memberIds.includes(currentUserId)) {
    return { error: "Tu n'es pas membre de cette ligue." }
  }

  const { data: collectionRows, error: collectionErr } = await supabaseAdmin
    .from('user_collection')
    .select('user_id, sticker_id, quantity, stickers_reference(sticker_id, display_name)')
    .in('user_id', memberIds)

  if (collectionErr) {
    console.error('[trades] getExchangeData user_collection:', collectionErr.message)
    return { error: collectionErr.message }
  }

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
    ...memberIds.filter((id) => id !== currentUserId).map(buildMember),
  ]

  return { currentUserId, members }
}

// ── Helper partagé : mettre à jour la collection d'un côté ───────────────────

async function decrementOrDelete(userId: string, stickerId: string): Promise<string | null> {
  const { data: row, error: fetchErr } = await supabaseAdmin
    .from('user_collection')
    .select('quantity')
    .eq('user_id', userId)
    .eq('sticker_id', stickerId)
    .maybeSingle()

  if (fetchErr) return fetchErr.message

  if (!row) return null

  const qty = (row.quantity as number | null) ?? 1
  if (qty <= 1) {
    const { error } = await supabaseAdmin
      .from('user_collection')
      .delete()
      .eq('user_id', userId)
      .eq('sticker_id', stickerId)
    if (error) return error.message
  } else {
    const { error } = await supabaseAdmin
      .from('user_collection')
      .update({ quantity: qty - 1 })
      .eq('user_id', userId)
      .eq('sticker_id', stickerId)
    if (error) return error.message
  }
  return null
}

async function incrementOrInsert(userId: string, stickerId: string): Promise<string | null> {
  const { data: row, error: fetchErr } = await supabaseAdmin
    .from('user_collection')
    .select('quantity')
    .eq('user_id', userId)
    .eq('sticker_id', stickerId)
    .maybeSingle()

  if (fetchErr) return fetchErr.message

  if (row) {
    const qty = (row.quantity as number | null) ?? 1
    const { error } = await supabaseAdmin
      .from('user_collection')
      .update({ quantity: qty + 1 })
      .eq('user_id', userId)
      .eq('sticker_id', stickerId)
    if (error) return error.message
  } else {
    const { error } = await supabaseAdmin
      .from('user_collection')
      .insert({ user_id: userId, sticker_id: stickerId, quantity: 1 })
    if (error) return error.message
  }
  return null
}

// ── confirmReception ──────────────────────────────────────────────────────────

export type Donation = {
  giverId: string
  stickerId: string
}

export async function confirmReception(
  donations: Donation[],
): Promise<TradeSuccess | { error: string }> {
  const receiverId = await getAuthUserId()
  if (!receiverId) return { error: 'Non authentifié.' }

  if (!donations || donations.length === 0) {
    return { success: true, new_badges: [], new_trophies: [] }
  }

  for (const { giverId, stickerId } of donations) {
    const err1 = await decrementOrDelete(giverId, stickerId)
    if (err1) { console.error('[trades] confirmReception giver:', err1); return { error: err1 } }

    const err2 = await incrementOrInsert(receiverId, stickerId)
    if (err2) { console.error('[trades] confirmReception receiver:', err2); return { error: err2 } }
  }

  const checks = await runChecksForUser(receiverId)
  return { success: true, ...checks }
}

// ── confirmDonation ───────────────────────────────────────────────────────────

export type DonationOut = {
  stickerId: string
  receiverId: string
}

export async function confirmDonation(
  donations: DonationOut[],
): Promise<TradeSuccess | { error: string }> {
  const giverId = await getAuthUserId()
  if (!giverId) return { error: 'Non authentifié.' }

  if (!donations || donations.length === 0) {
    return { success: true, new_badges: [], new_trophies: [] }
  }

  for (const { stickerId, receiverId } of donations) {
    const err1 = await decrementOrDelete(giverId, stickerId)
    if (err1) { console.error('[trades] confirmDonation giver:', err1); return { error: err1 } }

    const err2 = await incrementOrInsert(receiverId, stickerId)
    if (err2) { console.error('[trades] confirmDonation receiver:', err2); return { error: err2 } }
  }

  // On vérifie aussi le receveur (premier receiverId — tous peuvent être différents, on prend l'unique)
  const uniqueReceivers = [...new Set(donations.map((d) => d.receiverId))]
  const allChecks = await Promise.all(uniqueReceivers.map(runChecksForUser))
  const new_badges = allChecks.flatMap((c) => c.new_badges)
  const new_trophies = allChecks.flatMap((c) => c.new_trophies)

  return { success: true, new_badges, new_trophies }
}
