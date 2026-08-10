import { OrdersPage } from '@/components/features/orders/OrdersPage';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Orders Management | Dineiz Go Dashboard',
};

export default function OrdersRoute() {
  return <OrdersPage />;
}
