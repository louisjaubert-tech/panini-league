import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { joinLeague } from '@/app/actions/leagues'

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params

  const cookieStore = await cookies()
  const token = cookieStore.get('sb-access-token')?.value

  // Non connecté → renvoyer vers login avec redirect en paramètre
  if (!token) {
    redirect(`/login?redirect=/join/${code}`)
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    redirect(`/login?redirect=/join/${code}`)
  }

  // Connecté → rejoindre automatiquement la ligue
  const result = await joinLeague(code)

  if ('error' in result) {
    // Si déjà membre ou code invalide, on redirige quand même vers /leagues
    // pour ne pas bloquer l'utilisateur
    redirect('/leagues')
  }

  redirect('/leagues')
}
