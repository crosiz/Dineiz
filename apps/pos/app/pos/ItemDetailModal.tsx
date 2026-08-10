'use client';

import type { CachedMenuItem } from '@/lib/db';
import { useCartStore } from '@/lib/store';
import { formatPKR } from '@/lib/utils';
import { X, Plus, Minus, Check } from 'lucide-react';
import { useState } from 'react';

interface Props {
  item: CachedMenuItem;
  onClose: () => void;
}

export default function ItemDetailModal({ item, onClose }: Props) {
  const addItem = useCartStore((s) => s.addItem);

  const [selectedVariation, setSelectedVariation] = useState(
    item.variations.length > 0 ? item.variations[0] : null
  );
  const [selectedAddOns, setSelectedAddOns] = useState<typeof item.addOns>([]);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');

  const basePrice = selectedVariation ? selectedVariation.price : item.basePrice;
  const addOnsTotal = selectedAddOns.reduce((sum, a) => sum + a.price, 0);
  const unitPrice = basePrice + addOnsTotal;
  const lineTotal = unitPrice * quantity;

  const toggleAddOn = (addOn: (typeof item.addOns)[0]) => {
    setSelectedAddOns((prev) =>
      prev.find((a) => a.id === addOn.id)
        ? prev.filter((a) => a.id !== addOn.id)
        : [...prev, addOn]
    );
  };

  const handleAddToCart = () => {
    addItem({
      itemId: item.id,
      name: item.name,
      basePrice: item.basePrice,
      unitPrice,
      image: item.image,
      notes: notes || undefined,
      selectedVariation: selectedVariation ?? undefined,
      selectedAddOns,
    });
    // Add multiple times if quantity > 1
    for (let i = 1; i < quantity; i++) {
      addItem({
        itemId: item.id,
        name: item.name,
        basePrice: item.basePrice,
        unitPrice,
        image: item.image,
        notes: notes || undefined,
        selectedVariation: selectedVariation ?? undefined,
        selectedAddOns,
      });
    }
    onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 50, padding: '1rem',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--pos-bg-elevated)', border: '1px solid #334155',
          borderRadius: '1.5rem', width: '100%', maxWidth: 500,
          maxHeight: '90vh', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {item.image ? (
            <img
              src={item.image}
              alt={item.name}
              style={{ width: '100%', height: 200, objectFit: 'cover' }}
            />
          ) : (
            <div style={{ height: 120, background: '#0f172a' }} />
          )}
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: 12, right: 12,
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(0,0,0,0.6)', border: 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={18} color="#f1f5f9" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', scrollbarWidth: 'thin' }}>
          <h2 style={{ color: '#f1f5f9', fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>{item.name}</h2>
          {item.description && (
            <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: 6 }}>{item.description}</p>
          )}

          {/* Variations */}
          {item.variations.length > 0 && (
            <div style={{ marginTop: '1.25rem' }}>
              <p style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Size / Variation
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {item.variations.map((v) => {
                  const active = selectedVariation?.id === v.id;
                  return (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariation(v)}
                      style={{
                        padding: '0.5rem 1rem', borderRadius: '2rem',
                        border: `1px solid ${active ? 'var(--pos-primary)' : '#334155'}`,
                        background: active ? 'rgba(249,115,22,0.15)' : 'transparent',
                        color: active ? 'var(--pos-primary)' : '#94a3b8',
                        cursor: 'pointer', fontSize: '0.875rem', fontWeight: active ? 600 : 400,
                      }}
                    >
                      {v.name}
                      <span style={{ marginLeft: 4, opacity: 0.7 }}>{formatPKR(v.price)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add-ons */}
          {item.addOns.length > 0 && (
            <div style={{ marginTop: '1.25rem' }}>
              <p style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Add-ons
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {item.addOns.map((a) => {
                  const checked = !!selectedAddOns.find((x) => x.id === a.id);
                  return (
                    <label
                      key={a.id}
                      onClick={() => toggleAddOn(a)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.625rem 0.875rem', borderRadius: '0.75rem',
                        border: `1px solid ${checked ? 'var(--pos-primary)' : '#334155'}`,
                        background: checked ? 'rgba(249,115,22,0.08)' : 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                          border: `2px solid ${checked ? 'var(--pos-primary)' : '#475569'}`,
                          background: checked ? 'var(--pos-primary)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {checked && <Check size={12} color="#fff" />}
                        </div>
                        <span style={{ color: '#f1f5f9', fontSize: '0.875rem' }}>{a.name}</span>
                      </div>
                      <span style={{ color: 'var(--pos-primary)', fontWeight: 600, fontSize: '0.875rem' }}>
                        +{formatPKR(a.price)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Notes */}
          <div style={{ marginTop: '1.25rem' }}>
            <p style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Special Instructions
            </p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="E.g. No onions, extra spicy…"
              rows={2}
              style={{
                width: '100%', background: '#0f172a', border: '1px solid #334155',
                borderRadius: '0.75rem', padding: '0.625rem 0.875rem',
                color: '#f1f5f9', fontSize: '0.875rem', resize: 'none',
                outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.25rem', borderTop: '1px solid var(--pos-bg-elevated)',
          display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0,
        }}>
          {/* Qty stepper */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              style={{
                width: 36, height: 36, borderRadius: '50%',
                background: '#334155', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Minus size={16} color="#f1f5f9" />
            </button>
            <span style={{ color: '#f1f5f9', fontWeight: 700, minWidth: 24, textAlign: 'center', fontSize: '1.1rem' }}>
              {quantity}
            </span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'var(--pos-primary)', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Plus size={16} color="#fff" />
            </button>
          </div>

          {/* Add to cart */}
          <button
            onClick={handleAddToCart}
            style={{
              flex: 1, padding: '0.75rem',
              background: 'var(--pos-primary)',
              border: 'none', borderRadius: '0.875rem',
              color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}
          >
            <span>Add to Cart</span>
            <span>{formatPKR(lineTotal)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
