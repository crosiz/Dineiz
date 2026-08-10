import { BranchesPage } from '@/components/features/branches/BranchesPage';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Branch Management | Dineiz Go Dashboard',
};

export default function BranchesRoute() {
  return <BranchesPage />;
}
