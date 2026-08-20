'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/lib/store';
import { toast } from 'sonner';
import { getToken, getPosSession } from '@/lib/pos-session';

export default function ShiftOpenGate() {
  const router = useRouter();
  const session = useCartStore(s => s.session);
  const [float, setFloat] = useState<number | ''>('');
  const [showDenominations, setShowDenominations] = useState(false);
  const [denominations, setDenominations] = useState<Record<number, number>>({
    5000: 0, 1000: 0, 500: 0, 100: 0, 50: 0, 10: 0
  });
  
  const [timeStr, setTimeStr] = useState('00:00 AM');
  const [dateStr, setDateStr] = useState('Monday, January 1');
  const [greeting, setGreeting] = useState('Good Morning');

  const branchName = session?.branchName || getPosSession()?.branchName || 'Branch';

  useEffect(() => {
    const checkExistingShift = () => {
      const existingShift = localStorage.getItem('pos_shift');
      if (existingShift) {
        toast.info('Continuing existing shift');
        router.replace('/pos/home');
      }
    };
    checkExistingShift();
  }, [router]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }));
      setDateStr(now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }));
      const h = now.getHours();
      setGreeting(h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening');
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  // Auto-sum denominations into float
  useEffect(() => {
    const total = Object.entries(denominations).reduce(
      (sum, [denom, count]) => sum + Number(denom) * Number(count), 0
    );
    if (total > 0) setFloat(total);
  }, [denominations]);

  const handleStartShift = async () => {
    const floatAmount = float === '' ? 0 : float;
    if (floatAmount < 0) {
      toast.error('Please enter a valid float amount');
      return;
    }
    
    try {
      const payload = {
        branchId: session?.branchId,
        openingFloat: floatAmount
      };
      
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/shifts/open`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify(payload)
      });
      
      if (res.status === 409) {
        const errorData = await res.json().catch(() => ({}));
        const existingShiftId = errorData.shiftId;
        if (existingShiftId) {
          toast.success('Resumed existing open shift');
          useCartStore.setState({ session: { ...session, shiftId: existingShiftId } });
          localStorage.setItem('pos_shift', JSON.stringify({
            shiftId: existingShiftId,
            openedAt: new Date().toISOString(), // Or fetch actual openedAt if needed
            openingFloat: floatAmount, // We might not know original float, but this works to unblock
          }));
          router.push('/pos/home');
          return;
        }
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${res.status}`);
      }
      
      const data = await res.json();
      const shiftId = data.id;
      
      if (!shiftId) {
        throw new Error('Server returned OK but no shift ID was provided.');
      }
      
      useCartStore.setState({ session: { ...session, shiftId } });
      localStorage.setItem('pos_shift', JSON.stringify({
        shiftId,
        openedAt: new Date().toISOString(),
        openingFloat: floatAmount,
      }));
      toast.success('Shift opened successfully');
      router.push('/pos/home');
    } catch (err: any) {
      console.error('Failed to open shift:', err);
      toast.error(err.message || 'Error opening shift');
    }
  };

  const greetingEmoji = greeting === 'Good Morning' ? '☀️' : greeting === 'Good Afternoon' ? '🌤️' : '🌙';

  return (
    <div className="bg-[#F8FAFC] min-h-screen flex items-center justify-center font-body-md overflow-hidden antialiased p-4 text-[#0F172A]">
      {/* Subtle dot grid background */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(circle, rgba(245,158,11,0.06) 1px, transparent 1px)', backgroundSize: '24px 24px' }}
      />

      <main className="relative z-10 w-full max-w-[480px]">
        <div className="bg-white rounded-[20px] shadow-[0_10px_40px_rgba(0,0,0,0.08)] overflow-hidden border border-[#E2E8F0]">
          
          {/* CARD TOP: amber gradient header */}
          <header className="bg-gradient-to-br from-[#F59E0B] to-[#D97706] p-[28px] text-white flex flex-col items-center">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[20px]">{greetingEmoji}</span>
              <h1 className="text-[20px] font-bold clash-display">{greeting}!</h1>
            </div>
            <p className="text-[14px] text-white/90 mb-4 font-medium">{branchName}</p>
            <div className="text-[40px] font-bold tracking-tight mb-1 font-mono">
              {timeStr}
            </div>
            <p className="text-[14px] text-white/80">{dateStr}</p>
          </header>

          {/* CARD BODY — Light themed */}
          <div className="bg-white p-[28px]">

            {/* STAFF IDENTITY ROW */}
            <div className="flex items-center gap-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 mb-6">
              <div className="w-11 h-11 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-[#D97706] font-bold text-[15px]">
                {session?.cashierName?.substring(0, 2).toUpperCase() || 'AB'}
              </div>
              <div className="flex flex-col">
                <span className="text-[15px] font-bold text-[#0F172A]">{session?.cashierName || 'Operator'}</span>
                <span className="text-[12px] text-[#64748B] font-medium">Cashier • {branchName}</span>
              </div>
              <div className="ml-auto">
                <span className="material-symbols-outlined text-[#D97706]">verified_user</span>
              </div>
            </div>

            {/* OPENING FLOAT SECTION */}
            <section>
              <div className="flex flex-col mb-4">
                <label className="text-[13px] font-bold uppercase text-[#0F172A] tracking-[0.05em]">Opening Cash Float</label>
                <p className="text-[12px] text-[#64748B] mt-1 font-medium">Count the cash in your drawer and enter the total</p>
              </div>

              {/* LARGE INPUT */}
              <div className="relative group mb-4">
                <div className="h-[68px] border-2 border-[#CBD5E1] group-focus-within:border-[var(--pos-primary,#F59E0B)] rounded-xl bg-[#F8FAFC] flex items-center px-4 transition-all duration-200">
                  <div className="flex items-center">
                    <span className="text-[16px] font-bold text-[#475569] mr-3">PKR</span>
                    <div className="w-[2px] h-6 bg-[#CBD5E1]"></div>
                  </div>
                  <input 
                    className="w-full bg-transparent border-none text-right text-[24px] font-bold text-[#0F172A] focus:ring-0 placeholder:text-[#94A3B8] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                    id="floatInput" 
                    placeholder="0" 
                    type="number"
                    min="0"
                    value={float}
                    onChange={(e) => setFloat(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>
              </div>

              {/* QUICK FLOAT PILLS */}
              <div className="flex gap-2 mb-6">
                {[2000, 5000, 10000].map(amount => (
                  <button 
                    key={amount}
                    className={`flex-1 border transition-all rounded-full py-2 px-3 text-[13px] font-bold active:scale-95 duration-150 ${
                      float === amount 
                        ? 'border-[var(--pos-primary,#F59E0B)] bg-amber-50 text-[#D97706]'
                        : 'border-[#CBD5E1] text-[#475569] hover:border-[var(--pos-primary,#F59E0B)] hover:bg-amber-50'
                    }`}
                    onClick={() => setFloat(amount)}
                  >
                    PKR {amount.toLocaleString()}
                  </button>
                ))}
              </div>

              {/* DENOMINATION TOGGLE */}
              <div className="mb-8">
                <button 
                  className="text-[#D97706] text-[12px] font-bold flex items-center gap-1 hover:text-[#B45309] transition-colors"
                  onClick={() => setShowDenominations(!showDenominations)}
                >
                  Count by denomination 
                  <span className="material-symbols-outlined text-[16px]">{showDenominations ? 'expand_less' : 'expand_more'}</span>
                </button>

                {showDenominations && (
                  <div className="mt-4 grid grid-cols-2 gap-3 max-h-[220px] overflow-y-auto pr-2 no-scrollbar">
                    {[5000, 1000, 500, 100, 50, 10].map(denom => (
                      <div key={denom} className="flex items-center justify-between bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0]">
                        <span className="text-[13px] font-bold text-[#0F172A]">
                          PKR {denom.toLocaleString()}
                        </span>
                        <input 
                          type="number"
                          placeholder="0"
                          min="0"
                          value={denominations[denom] || ''}
                          onChange={(e) => setDenominations(prev => ({
                            ...prev, [denom]: Number(e.target.value) || 0
                          }))}
                          className="w-16 h-8 text-center bg-white border border-[#CBD5E1] rounded-lg outline-none text-[13px] text-[#0F172A] font-bold focus:ring-1 focus:ring-[var(--pos-primary,#F59E0B)] focus:border-[var(--pos-primary,#F59E0B)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none shadow-sm"
                        /></div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* FOOTER */}
            <footer className="flex flex-col items-center">
              <button 
                onClick={handleStartShift}
                className="w-full h-[54px] bg-[var(--pos-primary,#F59E0B)] hover:brightness-105 active:scale-[0.98] text-white font-bold text-[16px] rounded-xl flex items-center justify-center gap-2 transition-all duration-150 mb-3 shadow-md"
              >
                Start Shift
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
              <p className="text-[11px] text-[#64748B] text-center px-4 font-medium">
                Your shift record and all orders will be tracked from now
              </p>
              <button 
                onClick={() => {
                  localStorage.removeItem('pos_session');
                  router.push('/login');
                }}
                className="mt-4 text-[#ef4444] text-[13px] font-bold hover:underline"
              >
                Logout / Switch User
              </button>
            </footer>
          </div>
        </div>
      </main>
    </div>
  );
}
