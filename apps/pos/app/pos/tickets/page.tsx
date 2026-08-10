'use client';

import { useRouter } from 'next/navigation';
import TicketsDashboard from '../TicketsDashboard';

export default function TicketsPage() {
  const router = useRouter();
  
  return (
    <TicketsDashboard 
      onViewChange={(view) => {
        if (view === 'home') {
          router.push('/pos/home');
        } else if (view === 'menu') {
          router.push('/pos/order');
        } else if (view === 'tickets') {
          // Already here
        }
      }} 
    />
  );
}
