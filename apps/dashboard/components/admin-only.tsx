'use client';

import { ReactNode, useEffect } from 'react';
import { useUser } from '@/contexts/user-context';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export function AdminOnly({ children }: { children: ReactNode }) {
  const { role } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (role !== 'TENANT_ADMIN' && role !== 'SUPER_ADMIN') {
      toast.error('You do not have permission to access this page.');
      router.push('/dashboard');
    }
  }, [role, router]);

  if (role !== 'TENANT_ADMIN' && role !== 'SUPER_ADMIN') {
    return null; // Don't render anything while redirecting
  }

  return <>{children}</>;
}
