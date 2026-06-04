import { cookies } from 'next/headers'
import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import NavbarClient from './NavbarClient'

export default async function Navbar() {
  const cookieStore = await cookies()
  const token = cookieStore.get('sb-access-token')?.value

  if (!token) {
    return <NavbarClient isLoggedIn={false} username="" />
  }

  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    return <NavbarClient isLoggedIn={false} username="" />
  }

  // Récupère le username depuis la table profiles
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .single()

  const username =
    (profile?.username as string | null) ??
    user.email?.split('@')[0] ??
    'Joueur'

  return <NavbarClient isLoggedIn={true} username={username} />
}
