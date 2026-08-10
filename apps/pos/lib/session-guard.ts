import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { POSSession } from './store';

export function requireSession(session: POSSession, router: AppRouterInstance): boolean {
  if (!session.branchId || !session.cashierId) {
    router.replace('/login');
    return false;
  }
  return true;
}
