'use server'

import { cookies } from 'next/headers'
import { nanoid } from 'nanoid'
import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// ── Helper : récupérer le user_id depuis le cookie ───────────

async function getAuthUserId(): Promise<string | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('sb-access-token')?.value
  if (!token) return null

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return user.id
}

// ════════════════════════════════════════════════════════════
// createLeague
// ════════════════════════════════════════════════════════════

export async function createLeague(
  name: string
): Promise<{ league_id: string } | { error: string }> {
  const userId = await getAuthUserId()
  console.log('[leagues] supabase url:', process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 30))
  console.log('[leagues] service key prefix:', process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 20))

  if (!userId) return { error: 'Non authentifié.' }

  if (!name || name.trim().length < 2) {
    return { error: 'Le nom de la ligue doit faire au moins 2 caractères.' }
  }

  const invite_code = nanoid(8)

  const { data: league, error: insertErr } = await supabaseAdmin
    .from('leagues')
    .insert({ name: name.trim(), invite_code, created_by: userId })
    .select('id')
    .single()

  if (insertErr || !league) {
    console.error('[leagues] createLeague insert:', insertErr?.message)
    return { error: insertErr?.message ?? 'Erreur lors de la création.' }
  }

  const { error: memberErr } = await supabaseAdmin
    .from('league_members')
    .insert({ league_id: league.id, user_id: userId })

  if (memberErr) {
    console.error('[leagues] createLeague member insert:', memberErr.message)
    // Rollback : supprimer la ligue créée
    await supabaseAdmin.from('leagues').delete().eq('id', league.id)
    return { error: 'Erreur lors de l\'ajout du créateur à la ligue.' }
  }

  return { league_id: league.id as string }
}

// ════════════════════════════════════════════════════════════
// joinLeague
// ════════════════════════════════════════════════════════════

export async function joinLeague(
  invite_code: string
): Promise<{ league_id: string } | { error: string }> {
  const userId = await getAuthUserId()
  if (!userId) return { error: 'Non authentifié.' }

  if (!invite_code?.trim()) {
    return { error: 'Code d\'invitation manquant.' }
  }

  // Vérifier que la ligue existe
  const { data: league, error: leagueErr } = await supabaseAdmin
    .from('leagues')
    .select('id')
    .eq('invite_code', invite_code.trim())
    .single()

  if (leagueErr || !league) {
    return { error: 'Code d\'invitation invalide.' }
  }

  const leagueId = league.id as string

  // Vérifier que l'utilisateur n'est pas déjà membre
  const { data: existing } = await supabaseAdmin
    .from('league_members')
    .select('id')
    .eq('league_id', leagueId)
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) {
    return { error: 'Tu es déjà membre de cette ligue.' }
  }

  // Vérifier la limite de membres (< 30)
  const { count } = await supabaseAdmin
    .from('league_members')
    .select('id', { count: 'exact', head: true })
    .eq('league_id', leagueId)

  if ((count ?? 0) >= 30) {
    return { error: 'Cette ligue a atteint la limite de 30 membres.' }
  }

  const { error: memberErr } = await supabaseAdmin
    .from('league_members')
    .insert({ league_id: leagueId, user_id: userId })

  if (memberErr) {
    console.error('[leagues] joinLeague insert:', memberErr.message)
    return { error: memberErr.message }
  }

  return { league_id: leagueId }
}

// ════════════════════════════════════════════════════════════
// leaveLeague
// ════════════════════════════════════════════════════════════

export async function leaveLeague(
  league_id: string
): Promise<{ success: true } | { error: string }> {
  const userId = await getAuthUserId()
  if (!userId) return { error: 'Non authentifié.' }

  if (!league_id) return { error: '`league_id` manquant.' }

  // Vérifier que l'utilisateur est membre
  const { data: membership } = await supabaseAdmin
    .from('league_members')
    .select('id')
    .eq('league_id', league_id)
    .eq('user_id', userId)
    .maybeSingle()

  if (!membership) {
    return { error: 'Tu n\'es pas membre de cette ligue.' }
  }

  // Récupérer les infos de la ligue et tous les membres
  const { data: league } = await supabaseAdmin
    .from('leagues')
    .select('created_by')
    .eq('id', league_id)
    .single()

  const { data: members } = await supabaseAdmin
    .from('league_members')
    .select('user_id, joined_at')
    .eq('league_id', league_id)
    .order('joined_at', { ascending: true })

  const remainingMembers = (members ?? []).filter((m) => m.user_id !== userId)

  if (remainingMembers.length === 0) {
    // Dernier membre → supprimer la ligue entière
    await supabaseAdmin.from('league_members').delete().eq('league_id', league_id)
    const { error: deleteErr } = await supabaseAdmin
      .from('leagues')
      .delete()
      .eq('id', league_id)

    if (deleteErr) {
      console.error('[leagues] leaveLeague delete league:', deleteErr.message)
      return { error: deleteErr.message }
    }
    return { success: true }
  }

  // Transférer created_by si l'utilisateur est le créateur
  if (league?.created_by === userId) {
    const newOwner = remainingMembers[0].user_id as string
    const { error: transferErr } = await supabaseAdmin
      .from('leagues')
      .update({ created_by: newOwner })
      .eq('id', league_id)

    if (transferErr) {
      console.error('[leagues] leaveLeague transfer ownership:', transferErr.message)
      return { error: 'Erreur lors du transfert de propriété.' }
    }
  }

  // Supprimer le membre
  const { error: deleteErr } = await supabaseAdmin
    .from('league_members')
    .delete()
    .eq('league_id', league_id)
    .eq('user_id', userId)

  if (deleteErr) {
    console.error('[leagues] leaveLeague delete member:', deleteErr.message)
    return { error: deleteErr.message }
  }

  return { success: true }
}
