'use client';

import { useEffect, useRef } from 'react';
import { CheckCircle, UtensilsCrossed, Package, Bike } from 'lucide-react';
import { KdsOrder } from './hooks/useKDS';

interface KDSOrderCardProps {
  order: KdsOrder;
  isRemoving: boolean;
  selectedStationId: string | null;
  onMarkItemReady: (orderId: string, itemId: string) => void;
  onMarkOrderReady: (orderId: string) => void;
  isDark: boolean;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const remM = m % 60;
    return `${h}h ${remM}m`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Get timer color from elapsed seconds
function timerColor(seconds: number): string {
  if (seconds < 600) return '#4ade80'; // text-green-400
  if (seconds < 1200) return '#facc15'; // text-yellow-400
  return '#f87171'; // text-red-400
}

function OrderTypeBadge({ type, tableLabel, token }: { type: string; tableLabel: string | null; token: string | null }) {
  if (type === 'DINE_IN') {
    return (
      <span
        className="px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1"
        style={{ background: 'rgba(59,130,246,0.15)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.3)' }}
      >
        <UtensilsCrossed size={12} />
        Dine-In {tableLabel ? `T${tableLabel}` : ''}
      </span>
    );
  }
  if (type === 'TAKEAWAY') {
    return (
      <span
        className="px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1"
        style={{ background: 'rgba(139,92,246,0.15)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.3)' }}
      >
        <Package size={12} />
        Takeout {token ? `#${token}` : ''}
      </span>
    );
  }
  // DELIVERY
  return (
    <span
      className="px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1"
      style={{ background: 'rgba(249,115,22,0.15)', color: '#fdba74', border: '1px solid rgba(249,115,22,0.3)' }}
    >
      <Bike size={12} />
      Delivery
    </span>
  );
}

export function KDSOrderCard({
  order,
  isRemoving,
  selectedStationId,
  onMarkItemReady,
  onMarkOrderReady,
  isDark,
}: KDSOrderCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Slide-in on mount
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = 'translateY(-16px)';
    requestAnimationFrame(() => {
      el.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    });
  }, []);

  const color = timerColor(order.secondsElapsed);
  const allReady = order.items.every(it => it.isReady);

  // Filter items by station if selected
  const visibleItems = selectedStationId
    ? order.items.filter(it => it.stationId === selectedStationId || it.stationId === null)
    : order.items;

  const cardStyle: React.CSSProperties = {
    background: isDark ? '#1A1A2E' : '#ffffff',
    borderRadius: '12px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    border: order.isDelayed
      ? '2px solid rgba(239,68,68,0.8)'
      : isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0',
    boxShadow: order.isDelayed ? '0 0 15px rgba(239,68,68,0.4)' : undefined,
    opacity: isRemoving ? 0 : 1,
    transform: isRemoving ? 'scale(0.95)' : 'scale(1)',
    transition: 'opacity 0.5s ease, transform 0.5s ease',
  };

  return (
    <div ref={cardRef} style={cardStyle}>
      {/* Card header */}
      <div className="flex justify-between items-start p-4 pb-2">
        <div className="flex flex-col gap-1">
          <span
            className={`font-bold text-xl ${isDark ? 'text-white' : 'text-slate-900'}`}
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            #{order.orderNumber}
          </span>
          <div className="flex gap-2">
            {order.isDelayed && (
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest w-fit"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
              >
                DELAYED
              </span>
            )}
            {!order.isDelayed && order.isRush && (
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest w-fit"
                style={{ background: 'rgba(249,115,22,0.1)', color: '#f97316' }}
              >
                RUSH
              </span>
            )}
            {!order.isRush && order.isNew && (
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest w-fit"
                style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}
              >
                NEW
              </span>
            )}
          </div>
        </div>
        <OrderTypeBadge type={order.type} tableLabel={order.tableLabel} token={order.token} />
      </div>

      {/* Timer row */}
      <div className="flex justify-center items-center py-4 border-b" style={{ borderColor: isDark ? 'rgba(30,41,59,0.5)' : '#e2e8f0' }}>
        <span
          className={`font-black ${order.secondsElapsed >= 1200 ? 'animate-pulse' : ''}`}
          style={{ color, fontFamily: "'JetBrains Mono', monospace", fontSize: '48px', lineHeight: '1' }}
        >
          {formatElapsed(order.secondsElapsed)}
        </span>
      </div>

      {/* Items list */}
      <div className="p-4 flex-grow flex flex-col gap-4">
        {visibleItems.map(item => (
          <div key={item.id} className="flex flex-col gap-1">
            <div className="flex items-start gap-3">
              {/* Checkbox */}
              <button
                onClick={() => onMarkItemReady(order.id, item.id)}
                disabled={item.isReady}
                className="mt-0.5 shrink-0 w-5 h-5 rounded flex items-center justify-center transition-all"
                style={{
                  background: item.isReady ? '#10b981' : 'transparent',
                  border: item.isReady ? '1px solid #10b981' : (isDark ? '1px solid #475569' : '1px solid #cbd5e1'),
                }}
                aria-label={`Mark ${item.name} ready`}
              >
                {item.isReady && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>

              <div className="flex-1">
                <p
                  className="text-lg font-bold"
                  style={{
                    color: item.isReady ? '#64748b' : (isDark ? 'white' : '#0f172a'),
                    textDecoration: item.isReady ? 'line-through' : 'none',
                  }}
                >
                  {item.name}{' '}
                  <span style={{ color: '#f97316' }}>×{item.quantity}</span>
                </p>
                {item.variation && (
                  <p className="text-sm italic" style={{ color: '#94a3b8' }}>
                    {item.variation}
                  </p>
                )}
                {item.addons.map((addon, i) => (
                  <p key={i} className="text-[12px]" style={{ color: '#64748b' }}>
                    + {addon}
                  </p>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Mark All Ready button */}
      <button
        onClick={() => onMarkOrderReady(order.id)}
        className="w-full py-4 font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-colors"
        style={{
          background: allReady ? '#059669' : '#10b981',
          color: 'white',
          animation: allReady ? 'kds-pulse-once 0.6s ease' : undefined,
        }}
      >
        <CheckCircle size={18} />
        Mark All Ready
      </button>
    </div>
  );
}
