import { OrdersPage } from '@/components/features/orders/OrdersPage';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Order History | Dineiz Go Dashboard',
};

export default function OrderHistoryRoute() {
  return <OrdersPage />;
}
