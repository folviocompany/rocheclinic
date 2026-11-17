import 'server-only';

import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseConfig } from '@/lib/supabase/config';

/**
 * Camada central de autorização e dados mínimos da profissional conectada.
 * O cache do React evita repetir a leitura durante o mesmo render no servidor.
 */
export const requireMember = cache(async () => {
  if (!getSupabaseConfig()) redirect('/login');

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) redirect('/login');

  const [profileResult, professionalResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, display_name, active')
      .eq('id', userId)
      .eq('active', true)
      .maybeSingle(),
    supabase
      .from('professionals')
      .select('id, user_id, specialty, color')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  if (profileResult.error || !profileResult.data) redirect('/login?notice=access');
  if (professionalResult.error || !professionalResult.data) redirect('/login?notice=access');

  const email = typeof claimsData.claims.email === 'string' ? claimsData.claims.email : undefined;

  return {
    supabase,
    user: { id: userId, email },
    profile: profileResult.data,
    professional: professionalResult.data,
  };
});
