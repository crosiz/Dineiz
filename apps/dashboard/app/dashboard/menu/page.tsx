import { MenuPage } from '@/components/features/menu/MenuPage';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Menu Management | Dineiz Go Dashboard',
};

export default function MenuRoute() {
  return <MenuPage />;
}
