import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type UserRole = 'sales' | 'reservations' | 'admin';

export async function requireRole(allowedRoles: UserRole[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', user.id)
    .single();

  if (!profile || !allowedRoles.includes(profile.role as UserRole)) {
    redirect('/unauthorized');
  }

  return { user, profile, supabase };
}