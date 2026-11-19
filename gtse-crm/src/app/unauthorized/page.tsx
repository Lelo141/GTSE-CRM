import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-6 text-center">
      <h1 className="text-2xl font-bold">Access Restricted</h1>
      <p className="max-w-md text-sm text-slate-600">
        Your current role does not have permission to view this workspace.
      </p>
      <Link href="/" className={buttonVariants()}>
        Return to My Workspace
      </Link>
    </div>
  );
}