'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface CrmHeaderProps {
  fullName: string;
  role: 'sales' | 'reservations' | 'admin';
}

export function CrmHeader({ fullName, role }: CrmHeaderProps) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-bold tracking-tight">
            GTSE CRM
          </Link>
          <nav className="flex items-center gap-4 text-sm font-medium text-slate-600">
            {(role === 'reservations' || role === 'admin') && (
              <Link href="/reservations" className="hover:text-slate-900">
                Reservations Log
              </Link>
            )}
            {(role === 'sales' || role === 'admin') && (
              <Link href="/sales" className="hover:text-slate-900">
                Sales Workspace
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600">{fullName}</span>
          <Badge variant="secondary" className="capitalize">
            {role}
          </Badge>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            Sign Out
          </Button>
        </div>
      </div>
    </header>
  );
}