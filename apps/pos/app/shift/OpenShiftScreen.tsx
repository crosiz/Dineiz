'use client';

import { useState } from 'react';
import { useCartStore } from '@/lib/store';
import { DollarSign, Clock, User, AlertCircle } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const FLOAT_SHORTCUTS = [500, 1000, 2000, 5000, 10000];

interface Props {
  onShiftOpened: (shiftId: string) => void;
}

export default function OpenShiftScreen({ onShiftOpened }: Props) {
  const session = useCartStore((s) => s.session);
  const [openingFloat, setOpeningFloat] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long' });

  async function handleOpen() {
    if (!session.branchId) { setError('No branch assigned. Contact your admin.'); return; }
    setIsSubmitting(true); setError('');
    try {
      const res = await fetch(`${API_URL}/api/shifts/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          branchId: session.branchId,
          userId: session.cashierId,
          initialCashFloat: Number(openingFloat),
        }),
      });
      if (res.status === 409) { const d = await res.json(); onShiftOpened(d.shiftId); return; }
      if (!res.ok) throw new Error(`API ${res.status}`);
      const shift = await res.json();
      onShiftOpened(shift.id);
    } catch { setError('Failed to open shift. Check your connection.'); }
    finally { setIsSubmitting(false); }
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'radial-gradient(ellipse at top, #0f2942 0%, #0f172a 60%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: '2rem', padding: '2rem',
    }}>
      <style>{`@keyframes pulse-ring { 0%{box-shadow:0 0 0 0 rgba(249,115,22,.4)} 70%{box-shadow:0 0 0 18px rgba(249,115,22,0)} 100%{box-shadow:0 0 0 0 rgba(249,115,22,0)} }`}</style>

      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'rgba(249,115,22,0.15)', border: '1px solid var(--pos-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1.25rem', animation: 'pulse-ring 2s infinite',
        }}>
          <DollarSign size={32} color="var(--pos-primary)" />
        </div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f1f5f9', margin: '0 0 0.5rem' }}>Open Shift</h1>
        <p style={{ color: '#64748b' }}>Count your opening float and start your shift</p>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        {[timeStr, dateStr, session.cashierName ?? 'Cashier'].map((label, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(30,41,59,0.8)', border: '1px solid #1e3a5f',
            borderRadius: '2rem', padding: '0.4rem 1rem', color: '#94a3b8', fontSize: '0.8rem',
          }}>
            {i === 2 ? <User size={13} /> : <Clock size={13} />}
            <span>{label}</span>
          </div>
        ))}
      </div>

      <div style={{
        background: 'rgba(30,41,59,0.85)', backdropFilter: 'blur(12px)',
        border: '1px solid #1e3a5f', borderRadius: '2rem',
        padding: '2.5rem 2rem', width: '100%', maxWidth: 400,
        boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
      }}>
        <p style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
          Opening Cash Float
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
          {FLOAT_SHORTCUTS.map((amt) => (
            <button key={amt} onClick={() => setOpeningFloat(String(amt))} style={{
              padding: '0.55rem', borderRadius: '0.75rem',
              border: `1px solid ${openingFloat === String(amt) ? 'var(--pos-primary)' : '#334155'}`,
              background: openingFloat === String(amt) ? 'rgba(249,115,22,0.15)' : 'transparent',
              color: openingFloat === String(amt) ? 'var(--pos-primary)' : '#64748b',
              cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
            }}>
              PKR {amt >= 1000 ? `${amt/1000}k` : amt}
            </button>
          ))}
          <button onClick={() => setOpeningFloat('')} style={{
            padding: '0.55rem', borderRadius: '0.75rem', border: '1px solid #334155',
            background: 'transparent', color: '#475569', cursor: 'pointer', fontSize: '0.75rem',
          }}>Clear</button>
        </div>

        <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
          <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--pos-primary)', fontWeight: 700 }}>PKR</span>
          <input type="number" value={openingFloat} onChange={(e) => setOpeningFloat(e.target.value)}
            placeholder="0"
            style={{
              width: '100%', background: '#0f172a', border: '1px solid #334155',
              borderRadius: '0.875rem', padding: '0.875rem 1rem 0.875rem 3rem',
              color: '#f1f5f9', fontSize: '1.4rem', fontWeight: 700,
              outline: 'none', boxSizing: 'border-box', textAlign: 'right',
            }}
          />
        </div>

        {error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(248,113,113,0.1)', border: '1px solid #f87171',
            borderRadius: '0.75rem', padding: '0.75rem', marginBottom: '1rem',
          }}>
            <AlertCircle size={16} color="#f87171" />
            <span style={{ color: '#f87171', fontSize: '0.85rem' }}>{error}</span>
          </div>
        )}

        <button onClick={handleOpen} disabled={isSubmitting} style={{
          width: '100%', padding: '0.9rem',
          background: 'var(--pos-primary)',
          border: 'none', borderRadius: '0.875rem', color: '#fff',
          fontWeight: 700, fontSize: '1rem', cursor: 'pointer', opacity: isSubmitting ? 0.7 : 1,
        }}>
          {isSubmitting ? 'Opening Shift…' : `Open Shift${openingFloat ? ` · PKR ${parseInt(openingFloat).toLocaleString()}` : ''}`}
        </button>
      </div>
    </div>
  );
}
