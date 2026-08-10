'use client';

import { useRouter } from 'next/navigation';
import { CloseShiftModal } from '@/components/CloseShiftModal';

export default function ShiftClosePage() {
  const router = useRouter();
  
  // Render the real modal component which handles API submission and redirect to /login
  return (
    <div className="bg-[var(--pos-bg-base)] min-h-screen">
      <CloseShiftModal 
        isOpen={true} 
        onClose={() => router.push('/pos')} 
      />
    </div>
  );
}
