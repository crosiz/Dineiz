import { Metadata } from 'next';
import { KDSPage } from '@/components/features/kds/KDSPage';

export const metadata: Metadata = {
  title: 'Kitchen Display System | Dineiz Go',
};

export default function KDSRoute() {
  return <KDSPage />;
}
