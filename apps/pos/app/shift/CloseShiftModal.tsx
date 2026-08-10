'use client';

import { useEffect, useState } from 'react';
import { useCartStore } from '@/lib/store';
import { X, TrendingUp, Banknote, CreditCard, CheckCircle, AlertTriangle } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// Pakistani note denominations in descending order
const DENOMINATIONS = [5000, 1000, 500, 100, 50, 20, 10, 5, 2, 1];

interface ShiftSummary {
  totalSales: number;
  totalCash: number;
  totalCard: number;
  totalDiscount: number;
  totalTax: number;
  totalOrders: number;
  openingFloat: number;
}

interface Props {
  shiftId: string;
  onClose: () => void;
  onShiftClosed: () => void;
}

export default function CloseShiftModal({ shiftId, onClose, onShiftClosed }: Props) {
  const session = useCartStore((s) => s.session);
  const setSession = useCartStore((s) => s.setSession);

  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  const [denomQty, setDenomQty] = useState<Record<number, number>>({});
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'summary' | 'denominations' | 'confirm'>('summary');

  useEffect(() => {
    fetch(`${API_URL}/api/shifts/${shiftId}/summary`, { credentials: 'include' })
      .then((r) => r.json())
      .then(setSummary)
      .catch(() => setError('Could not load shift summary.'));
  }, [shiftId]);

  const countedCash = DENOMINATIONS.reduce((sum, d) => sum + d * (denomQty[d] ?? 0), 0);
  const expectedCash = summary ? summary.openingFloat + summary.totalCash : 0;
  const variance = countedCash - expectedCash;

  async function handleClose() {
    setIsSubmitting(true); setError('');
    try {
      const res = await fetch(`${API_URL}/api/shifts/${shiftId}/close`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          closingCash: countedCash,
          notes: notes || undefined,
          denominations: DENOMINATIONS
            .filter((d) => (denomQty[d] ?? 0) > 0)
            .map((d) => ({ denomination: d, quantity: denomQty[d] })),
        }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      setSession({ shiftId: null });
      onShiftClosed();
    } catch { setError('Failed to close shift. Please try again.'); }
    finally { setIsSubmitting(false); }
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200, padding: '1rem',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'var(--pos-bg-elevated)', border: '1px solid #334155', borderRadius: '1.5rem',
        width: '100%', maxWidth: 520, maxHeight: '92vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', boxShadow: '0 40px 100px rgba(0,0,0,0.7)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1.25rem 1.5rem', borderBottom: '1px solid #334155', flexShrink: 0,
        }}>
          <div>
            <p style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '1.1rem', margin: 0 }}>Close Shift</p>
            <p style={{ color: '#64748b', fontSize: '0.8rem', margin: '2px 0 0' }}>
              Cashier: {session.cashierName}
            </p>
          </div>
          {/* Step indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {(['summary', 'denominations', 'confirm'] as const).map((s, i) => (
              <div key={s} style={{
                width: 8, height: 8, borderRadius: '50%',
                background: step === s ? 'var(--pos-primary)' : '#334155',
              }} />
            ))}
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: 8 }}>
              <X size={18} color="#64748b" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin' }}>

          {/* ── Step 1: Summary ── */}
          {step === 'summary' && (
            <div style={{ padding: '1.5rem' }}>
              <p style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>
                Shift Summary
              </p>
              {summary ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <SummaryCard icon={<TrendingUp size={18} color="var(--pos-primary)" />} label="Total Sales"
                    value={`Rs. ${summary.totalSales.toFixed(0)}`} accent="var(--pos-primary)" />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <SummaryCard icon={<Banknote size={16} color="#22c55e" />} label="Cash"
                      value={`Rs. ${summary.totalCash.toFixed(0)}`} accent="#22c55e" small />
                    <SummaryCard icon={<CreditCard size={16} color="#3b82f6" />} label="Card"
                      value={`Rs. ${summary.totalCard.toFixed(0)}`} accent="#3b82f6" small />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <SummaryCard label="Orders" value={String(summary.totalOrders)} small />
                    <SummaryCard label="Tax Collected" value={`Rs. ${summary.totalTax.toFixed(0)}`} small />
                  </div>
                  <div style={{
                    background: '#0f172a', borderRadius: '0.875rem', padding: '0.875rem 1rem',
                    display: 'flex', justifyContent: 'space-between',
                  }}>
                    <span style={{ color: '#64748b', fontSize: '0.875rem' }}>Opening Float</span>
                    <span style={{ color: '#94a3b8', fontWeight: 600 }}>Rs. {summary.openingFloat.toFixed(0)}</span>
                  </div>
                  <div style={{
                    background: '#0f172a', borderRadius: '0.875rem', padding: '0.875rem 1rem',
                    display: 'flex', justifyContent: 'space-between',
                  }}>
                    <span style={{ color: '#64748b', fontSize: '0.875rem' }}>Expected in Drawer</span>
                    <span style={{ color: '#f1f5f9', fontWeight: 700 }}>
                      PKR {(summary.openingFloat + summary.totalCash).toFixed(0)}
                    </span>
                  </div>
                </div>
              ) : (
                <p style={{ color: '#475569', textAlign: 'center', paddingTop: '2rem' }}>
                  {error || 'Loading summary…'}
                </p>
              )}
            </div>
          )}

          {/* ── Step 2: Cash Count by Denomination ── */}
          {step === 'denominations' && (
            <div style={{ padding: '1.5rem' }}>
              <p style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>
                Count Cash by Denomination
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {DENOMINATIONS.map((d) => {
                  const qty = denomQty[d] ?? 0;
                  const lineTotal = d * qty;
                  return (
                    <div key={d} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      background: qty > 0 ? 'rgba(249,115,22,0.06)' : '#0f172a',
                      border: `1px solid ${qty > 0 ? 'var(--pos-primary)' : 'var(--pos-bg-elevated)'}`,
                      borderRadius: '0.875rem', padding: '0.625rem 0.875rem',
                    }}>
                      <span style={{ color: '#94a3b8', fontWeight: 700, minWidth: 52, fontSize: '0.9rem' }}>
                        PKR {d}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                        <button onClick={() => setDenomQty((p) => ({ ...p, [d]: Math.max(0, (p[d] ?? 0) - 1) }))}
                          style={{ width: 28, height: 28, borderRadius: 8, background: '#334155', border: 'none', cursor: 'pointer', color: '#f1f5f9', fontSize: '1rem' }}>−</button>
                        <input type="number" value={qty === 0 ? '' : qty}
                          onChange={(e) => setDenomQty((p) => ({ ...p, [d]: Math.max(0, parseInt(e.target.value) || 0) }))}
                          placeholder="0"
                          style={{ width: 52, textAlign: 'center', background: 'transparent', border: 'none', color: '#f1f5f9', fontWeight: 700, fontSize: '0.95rem', outline: 'none' }}
                        />
                        <button onClick={() => setDenomQty((p) => ({ ...p, [d]: (p[d] ?? 0) + 1 }))}
                          style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--pos-primary)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: '1rem' }}>+</button>
                      </div>
                      <span style={{ color: lineTotal > 0 ? 'var(--pos-primary)' : '#334155', fontWeight: 600, minWidth: 72, textAlign: 'right', fontSize: '0.85rem' }}>
                        {lineTotal > 0 ? `PKR ${lineTotal.toLocaleString()}` : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Running total */}
              <div style={{
                marginTop: 16, background: '#0f172a', borderRadius: '1rem', padding: '1rem',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ color: '#64748b' }}>Counted Cash</span>
                <span style={{ color: 'var(--pos-primary)', fontWeight: 800, fontSize: '1.25rem' }}>
                  PKR {countedCash.toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {/* ── Step 3: Confirm ── */}
          {step === 'confirm' && summary && (
            <div style={{ padding: '1.5rem' }}>
              <p style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>
                Reconciliation
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                <ReconRow label="Opening Float" value={summary.openingFloat} />
                <ReconRow label="Cash Sales" value={summary.totalCash} />
                <ReconRow label="Expected in Drawer" value={expectedCash} bold />
                <ReconRow label="Counted Cash" value={countedCash} />
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: Math.abs(variance) < 1 ? 'rgba(34,197,94,0.1)' : 'rgba(248,113,113,0.1)',
                  border: `1px solid ${Math.abs(variance) < 1 ? '#22c55e' : '#f87171'}`,
                  borderRadius: '0.875rem', padding: '0.875rem 1rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {Math.abs(variance) < 1
                      ? <CheckCircle size={16} color="#22c55e" />
                      : <AlertTriangle size={16} color="#f87171" />
                    }
                    <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Variance</span>
                  </div>
                  <span style={{
                    color: Math.abs(variance) < 1 ? '#22c55e' : '#f87171',
                    fontWeight: 700, fontSize: '1.1rem',
                  }}>
                    {variance >= 0 ? '+' : ''}PKR {variance.toFixed(0)}
                  </span>
                </div>
              </div>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Supervisor notes (optional)…" rows={2}
                style={{
                  width: '100%', background: '#0f172a', border: '1px solid #334155',
                  borderRadius: '0.75rem', padding: '0.75rem', color: '#f1f5f9',
                  fontSize: '0.875rem', resize: 'none', outline: 'none',
                  fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 16,
                }}
              />
              {error && <p style={{ color: '#f87171', fontSize: '0.85rem', marginBottom: 12 }}>{error}</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.5rem', borderTop: '1px solid var(--pos-bg-elevated)',
          display: 'flex', gap: 10, flexShrink: 0,
        }}>
          {step !== 'summary' && (
            <button onClick={() => setStep(step === 'confirm' ? 'denominations' : 'summary')}
              style={{ flex: 1, padding: '0.75rem', background: '#334155', border: 'none', borderRadius: '0.875rem', color: '#f1f5f9', cursor: 'pointer', fontWeight: 600 }}>
              ← Back
            </button>
          )}
          <button
            onClick={() => {
              if (step === 'summary') setStep('denominations');
              else if (step === 'denominations') setStep('confirm');
              else handleClose();
            }}
            disabled={isSubmitting || (step === 'summary' && !summary)}
            style={{
              flex: 2, padding: '0.875rem',
              background: step === 'confirm' ? 'linear-gradient(135deg,#ef4444,#dc2626)' : 'var(--pos-primary)',
              border: 'none', borderRadius: '0.875rem', color: '#fff',
              fontWeight: 700, fontSize: '1rem', cursor: 'pointer',
            }}
          >
            {step === 'summary' ? 'Count Cash →' : step === 'denominations' ? 'Review & Close →' : isSubmitting ? 'Closing…' : 'Confirm Close Shift'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value, accent = '#94a3b8', small = false }:
  { icon?: React.ReactNode; label: string; value: string; accent?: string; small?: boolean }) {
  return (
    <div style={{ background: '#0f172a', borderRadius: '0.875rem', padding: small ? '0.75rem' : '1rem' }}>
      {icon && <div style={{ marginBottom: 6 }}>{icon}</div>}
      <p style={{ color: '#64748b', fontSize: '0.75rem', margin: '0 0 4px' }}>{label}</p>
      <p style={{ color: accent, fontWeight: 700, fontSize: small ? '1rem' : '1.3rem', margin: 0 }}>{value}</p>
    </div>
  );
}

function ReconRow({ label, value, bold = false }: { label: string; value: number; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0',
      borderBottom: '1px solid var(--pos-bg-elevated)' }}>
      <span style={{ color: '#64748b', fontSize: '0.875rem' }}>{label}</span>
      <span style={{ color: bold ? '#f1f5f9' : '#94a3b8', fontWeight: bold ? 700 : 500, fontSize: '0.875rem' }}>
        PKR {value.toFixed(0)}
      </span>
    </div>
  );
}
