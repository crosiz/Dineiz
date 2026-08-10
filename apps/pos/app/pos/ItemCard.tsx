'use client';

import type { CachedMenuItem } from '@/lib/db';
import { useCartStore } from '@/lib/store';
import { formatPKR } from '@/lib/utils';
import { ImageIcon, Plus } from 'lucide-react';

interface Props {
  item: CachedMenuItem;
  onClick: () => void;
}

export default function ItemCard({ item, onClick }: Props) {
  const addItem = useCartStore((s) => s.addItem);

  const handleQuickAdd = (e: React.MouseEvent) => {
    // If item has variations, open the detail modal instead
    if (item.variations.length > 0 || item.addOns.length > 0) {
      onClick();
      return;
    }
    e.stopPropagation();
    addItem({
      itemId: item.id,
      name: item.name,
      basePrice: item.basePrice,
      unitPrice: item.basePrice,
      image: item.image,
      selectedAddOns: [],
    });
  };

  return (
    <div
      className="item-card-grid"
      onClick={onClick}
      style={{
        background: 'linear-gradient(145deg, var(--pos-bg-elevated), #162032)',
        border: '1px solid #1e3a5f',
        borderRadius: '1rem',
        overflow: 'hidden',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
      }}
    >
      {/* Image */}
      <div style={{
        width: '100%', aspectRatio: '4/3',
        background: '#0f172a',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', position: 'relative',
        flexShrink: 0,
      }}>
        {item.image ? (
          <img
            src={item.image}
            alt={item.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <ImageIcon size={32} color="#334155" />
        )}
        {!item.isAvailable && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#f87171', fontWeight: 600, fontSize: '0.75rem',
          }}>
            Unavailable
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '0.625rem 0.75rem', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <p style={{
          color: '#f1f5f9', fontWeight: 600, fontSize: '0.85rem',
          lineHeight: 1.3, margin: 0,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{item.name}</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
          <span style={{ color: 'var(--pos-primary)', fontWeight: 700, fontSize: '0.9rem' }}>
            {formatPKR(item.basePrice)}
          </span>
          <button
            onClick={handleQuickAdd}
            disabled={!item.isAvailable}
            style={{
              width: 28, height: 28, borderRadius: '50%',
              background: item.isAvailable ? 'var(--pos-primary)' : '#334155',
              border: 'none', cursor: item.isAvailable ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Plus size={16} color="#fff" />
          </button>
        </div>
        {(item.variations.length > 0 || item.addOns.length > 0) && (
          <span style={{ fontSize: '0.65rem', color: '#64748b' }}>
            {item.variations.length > 0 ? `${item.variations.length} sizes` : ''}
            {item.variations.length > 0 && item.addOns.length > 0 ? ' · ' : ''}
            {item.addOns.length > 0 ? `${item.addOns.length} add-ons` : ''}
          </span>
        )}
      </div>
    </div>
  );
}
