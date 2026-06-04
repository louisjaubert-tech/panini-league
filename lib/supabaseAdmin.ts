import { createClient } from '@supabase/supabase-js'

// Ce client utilise la service role key — à n'importer que dans des
// Server Components, Server Actions ou Route Handlers (jamais côté navigateur).
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
