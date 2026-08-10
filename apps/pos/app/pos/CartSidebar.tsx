'use client';

import { useCartStore } from '@/lib/store';
import { Trash2, Plus, Minus, ShoppingCart, Tag, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import CheckoutModal from './CheckoutModal';
import { formatPKR } from '@/lib/utils';

export default function CartSidebar() {
  const cart = useCartStore((s) => s.cart);
  const subtotal = useCartStore((s) => s.subtotal);
  const discountAmount = useCartStore((s) => s.discountAmount);
  const taxAmount = useCartStore((s) => s.taxAmount);
  const cashTaxAmount = useCartStore((s) => s.cashTaxAmount);
  const cardTaxAmount = useCartStore((s) => s.cardTaxAmount);
  const cashTotal = useCartStore((s) => s.cashTotal);
  const cardTotal = useCartStore((s) => s.cardTotal);
  const total = useCartStore((s) => s.total);
  const totalItems = useCartStore((s) => s.totalItems);
  const session = useCartStore((s) => s.session);
  const incrementItem = useCartStore((s) => s.incrementItem);
  const decrementItem = useCartStore((s) => s.decrementItem);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateItemNotes = useCartStore((s) => s.updateItemNotes);
  const orderType = useCartStore((s) => s.orderType);
  const setOrderType = useCartStore((s) => s.setOrderType);
  const discount = useCartStore((s) => s.discount);
  const setDiscount = useCartStore((s) => s.setDiscount);
  const promoCode = useCartStore((s) => s.autoDeals.promoCode);
  const setPromoCode = useCartStore((s) => s.setPromoCode);
  const fetchEligibleDeals = useCartStore((s) => s.fetchEligibleDeals);
  const validatePromoCode = useCartStore((s) => s.validatePromoCode);
  const isValidatingDeals = useCartStore((s) => s.autoDeals.isValidating);
  const eligibleDeals = useCartStore((s) => s.autoDeals.eligible);
  const applyDeal = useCartStore((s) => s.applyDeal);

  const cashRate = Math.round((session.cashTaxRate ?? 0.05) * 100);
  const cardRate = Math.round((session.cardTaxRate ?? 0.17) * 100);

  const [showDiscount, setShowDiscount] = useState(false);
  const [discountInput, setDiscountInput] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [promoInput, setPromoInput] = useState('');
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesInput, setNotesInput] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [showDealSheet, setShowDealSheet] = useState(false);

  // Fetch eligible deals whenever cart changes.
  useEffect(() => {
    void fetchEligibleDeals();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, session.branchId]);

  useEffect(() => {
    if (promoCode) void validatePromoCode();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promoCode]);

  const applyDiscount = () => {
    const val = parseFloat(discountInput);
    if (!isNaN(val) && val > 0) {
      setDiscount({ type: discountType, value: val });
    }
    setShowDiscount(false);
    setDiscountInput('');
  };

  const removeDiscount = () => setDiscount(null);

  const startEditNotes = (key: string, existing?: string) => {
    setEditingNotes(key);
    setNotesInput(existing ?? '');
  };

  const saveNotes = (itemId: string, variationId?: string) => {
    updateItemNotes(itemId, notesInput, variationId);
    setEditingNotes(null);
  };

  return (
    <aside style={{
      width: 340, minWidth: 300, maxWidth: 380,
      background: '#FFFFFF',
      borderLeft: '1px solid #E2E8F0',
      display: 'flex', flexDirection: 'column',
      height: '100vh',
    }}>

      {/* Cart Header */}
      <div style={{
        padding: '1rem 1.25rem', borderBottom: '1px solid #E2E8F0',
        display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
      }}>
        <ShoppingCart size={18} color="var(--pos-primary, #F59E0B)" />
        <span style={{ color: '#0F172A', fontWeight: 700, fontSize: '1rem' }}>
          Current Order
        </span>
        {totalItems() > 0 && (
          <span style={{
            marginLeft: 'auto', background: 'var(--pos-primary, #F59E0B)', color: '#fff',
            fontSize: '0.75rem', fontWeight: 700, borderRadius: '2rem',
            padding: '2px 8px',
          }}>
            {totalItems()}
          </span>
        )}
      </div>

      {/* Order Type */}
      <div style={{
        padding: '0.75rem 1.25rem', borderBottom: '1px solid #E2E8F0', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', borderRadius: '0.75rem', overflow: 'hidden', border: '1px solid #E2E8F0' }}>
          {(['DINE_IN', 'TAKEAWAY', 'DELIVERY'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setOrderType(type)}
              style={{
                flex: 1, padding: '0.45rem 0',
                background: orderType === type ? 'var(--pos-primary, #F59E0B)' : '#F8FAFC',
                border: 'none', cursor: 'pointer',
                color: orderType === type ? '#fff' : '#64748b',
                fontSize: '0.7rem', fontWeight: orderType === type ? 700 : 500,
                transition: 'all 0.15s',
              }}
            >
              {type === 'DINE_IN' ? 'Dine In' : type === 'TAKEAWAY' ? 'Takeaway' : 'Delivery'}
            </button>
          ))}
        </div>
      </div>

      {/* Cart Items */}
      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin' }}>
        {cart.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%', color: '#94a3b8', gap: 12,
          }}>
            <ShoppingCart size={40} />
            <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>Cart is empty</p>
          </div>
        ) : (
          <div style={{ padding: '0.5rem 0' }}>
            {cart.map((item, idx) => {
              const key = `${item.itemId}-${item.selectedVariation?.id ?? 'base'}-${idx}`;
              const isEditingThis = editingNotes === key;
              return (
                <div
                  key={key}
                  style={{
                    padding: '0.75rem 1.25rem',
                    borderBottom: '1px solid #E2E8F0',
                    display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
                  }}
                >
                  {/* Qty controls */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <button
                      onClick={() => incrementItem(item.itemId, item.selectedVariation?.id)}
                      style={{ width: 26, height: 26, borderRadius: 8, background: '#F1F5F9', border: '1px solid #CBD5E1', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Plus size={13} color="#0F172A" />
                    </button>
                    <span style={{ color: 'var(--pos-primary, #F59E0B)', fontWeight: 700, fontSize: '0.9rem', lineHeight: 1 }}>{item.quantity}</span>
                    <button
                      onClick={() => decrementItem(item.itemId, item.selectedVariation?.id)}
                      style={{ width: 26, height: 26, borderRadius: 8, background: '#F1F5F9', border: '1px solid #CBD5E1', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Minus size={13} color="#0F172A" />
                    </button>
                  </div>

                  {/* Item info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: '#0F172A', fontWeight: 700, fontSize: '0.875rem', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.name}
                    </p>
                    {item.selectedVariation && (
                      <p style={{ color: '#64748b', fontSize: '0.75rem', margin: '2px 0 0' }}>{item.selectedVariation.name}</p>
                    )}
                    {item.selectedAddOns.length > 0 && (
                      <p style={{ color: '#64748b', fontSize: '0.7rem', margin: '2px 0 0' }}>
                        +{item.selectedAddOns.map((a) => a.name).join(', ')}
                      </p>
                    )}

                    {/* Inline notes editor */}
                    {isEditingThis ? (
                      <div style={{ marginTop: 4 }}>
                        <input
                          autoFocus
                          value={notesInput}
                          onChange={(e) => setNotesInput(e.target.value)}
                          onBlur={() => saveNotes(item.itemId, item.selectedVariation?.id)}
                          onKeyDown={(e) => e.key === 'Enter' && saveNotes(item.itemId, item.selectedVariation?.id)}
                          placeholder="Add note…"
                          style={{
                            width: '100%', background: '#F8FAFC', border: '1px solid #CBD5E1',
                            borderRadius: 6, padding: '3px 6px', color: '#0F172A',
                            fontSize: '0.75rem', outline: 'none',
                          }}
                        />
                      </div>
                    ) : (
                      <button
                        onClick={() => startEditNotes(key, item.notes)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 2 }}
                      >
                        <p style={{ color: item.notes ? '#64748b' : '#94a3b8', fontSize: '0.7rem', fontStyle: 'italic', margin: 0 }}>
                          {item.notes || 'Add note…'}
                        </p>
                      </button>
                    )}
                  </div>

                  {/* Price + remove */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                    <span style={{ color: '#0F172A', fontWeight: 700, fontSize: '0.875rem' }}>
                      {formatPKR(item.subtotal)}
                    </span>
                    <button
                      onClick={() => removeItem(item.itemId, item.selectedVariation?.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                    >
                      <Trash2 size={13} color="#94a3b8" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Totals + Checkout */}
      {cart.length > 0 && (
        <div style={{ borderTop: '1px solid #E2E8F0', padding: '1rem 1.25rem', flexShrink: 0, background: '#F8FAFC' }}>

          {/* Discount input */}
          {showDiscount ? (
            <div style={{ marginBottom: '0.75rem', display: 'flex', gap: 6 }}>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as 'percent' | 'fixed')}
                style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: 8, padding: '4px 6px', color: '#0F172A', fontSize: '0.75rem', cursor: 'pointer' }}
              >
                <option value="percent">%</option>
                <option value="fixed">PKR</option>
              </select>
              <input
                autoFocus
                type="number"
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyDiscount()}
                placeholder={discountType === 'percent' ? 'e.g. 10' : 'e.g. 50'}
                style={{ flex: 1, background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: 8, padding: '4px 8px', color: '#0F172A', fontSize: '0.875rem', outline: 'none' }}
              />
              <button onClick={applyDiscount} style={{ background: 'var(--pos-primary, #F59E0B)', border: 'none', borderRadius: 8, padding: '4px 10px', color: '#fff', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}>Apply</button>
              <button onClick={() => setShowDiscount(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} color="#64748b" /></button>
            </div>
          ) : null}

          {/* Promo code */}
          <div style={{ marginBottom: '0.75rem', display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              value={promoInput}
              onChange={(e) => setPromoInput(e.target.value)}
              placeholder="Promo code (optional)"
              style={{ flex: 1, background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: 8, padding: '6px 10px', color: '#0F172A', fontSize: '0.85rem', outline: 'none' }}
            />
            <button
              onClick={() => setPromoCode(promoInput.trim() ? promoInput.trim().toUpperCase() : null)}
              style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: 8, padding: '6px 10px', color: '#475569', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
            >
              Apply
            </button>
            {promoCode && (
              <button
                onClick={() => { setPromoCode(null); setPromoInput(''); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                title="Clear promo"
              >
                <X size={16} color="#64748b" />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 500 }}>Subtotal</span>
              <span style={{ color: '#0F172A', fontSize: '0.85rem', fontWeight: 600 }}>{formatPKR(subtotal())}</span>
            </div>

            {/* Discount row */}
            {discount ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Tag size={12} color="#16a34a" />
                  <span style={{ color: '#16a34a', fontSize: '0.8rem', fontWeight: 600 }}>
                    {discount.label ?? (discount.type === 'percent' ? `${discount.value}% off` : `${formatPKR(discount.value)} off`)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ color: '#16a34a', fontSize: '0.85rem', fontWeight: 600 }}>−{formatPKR(discountAmount())}</span>
                  <button onClick={removeDiscount} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    <X size={12} color="#64748b" />
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => setShowDiscount(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  <Tag size={12} color="#D97706" />
                  <span style={{ color: '#D97706', fontSize: '0.78rem', fontWeight: 600 }}>Add discount</span>
                </button>
                <button
                  onClick={() => setShowDealSheet(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  <Tag size={12} color="#4F46E5" />
                  <span style={{ color: '#4F46E5', fontSize: '0.78rem', fontWeight: 600 }}>View Deals {eligibleDeals?.length > 0 ? `(${eligibleDeals.length})` : ''}</span>
                </button>
              </div>
            )}

            {session.cashTaxEnabled && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 500 }}>GST (Cash {cashRate}%)</span>
                <span style={{ color: '#0F172A', fontSize: '0.85rem', fontWeight: 600 }}>PKR {cashTaxAmount().toFixed(0)}</span>
              </div>
            )}
            {/* Dual-tax hint so cashier knows what card would cost */}
            {session.cardTaxEnabled && session.showDualTaxOnReceipt && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#F97316', fontSize: '0.75rem', fontWeight: 500 }}>GST (Card {cardRate}%)</span>
                <span style={{ color: '#F97316', fontSize: '0.75rem', fontWeight: 600 }}>PKR {cardTaxAmount().toFixed(0)}</span>
              </div>
            )}
            {isValidatingDeals && (
              <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Applying deals…</div>
            )}
            
            {/* Totals */}
            {session.cashTaxEnabled && session.cardTaxEnabled && session.showDualTaxOnReceipt ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid #E2E8F0' }}>
                  <span style={{ color: '#0F172A', fontWeight: 700, fontSize: '0.8rem' }}>💵 Cash Total</span>
                  <span style={{ color: 'var(--pos-primary, #F59E0B)', fontWeight: 800, fontSize: '1rem' }}>PKR {cashTotal().toFixed(0)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b', fontWeight: 600, fontSize: '0.8rem' }}>💳 Card Total</span>
                  <span style={{ color: '#F97316', fontWeight: 800, fontSize: '1rem' }}>PKR {cardTotal().toFixed(0)}</span>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid #E2E8F0' }}>
                <span style={{ color: '#0F172A', fontWeight: 700, fontSize: '0.8rem' }}>Total</span>
                <span style={{ color: 'var(--pos-primary, #F59E0B)', fontWeight: 800, fontSize: '1rem' }}>PKR {total().toFixed(0)}</span>
              </div>
            )}
          </div>

          <button
            onClick={() => setShowCheckout(true)}
            style={{
              width: '100%', padding: '0.875rem',
              background: 'var(--pos-primary, #F59E0B)',
              border: 'none', borderRadius: '0.875rem',
              color: '#FFFFFF', fontWeight: 700, fontSize: '1rem', cursor: 'pointer',
              letterSpacing: '0.01em', boxShadow: '0 4px 12px rgba(245,158,11,0.25)',
            }}
          >
            Checkout → {formatPKR(total())}
          </button>
        </div>
      )}

      {showCheckout && (
        <CheckoutModal onClose={() => setShowCheckout(false)} />
      )}

      {/* Deal Sheet Modal */}
      {showDealSheet && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.5)' }}>
          <div style={{ width: '400px', background: '#fff', height: '100%', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 15px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#0F172A' }}>Available Deals</h2>
              <button onClick={() => setShowDealSheet(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color="#64748b" /></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
              {isValidatingDeals && <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Loading deals...</p>}
              {!isValidatingDeals && eligibleDeals?.length === 0 && (
                <div style={{ textAlign: 'center', color: '#64748b', marginTop: 40 }}>
                  <Tag size={32} color="#cbd5e1" style={{ marginBottom: 12 }} />
                  <p>No eligible deals found for this cart.</p>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {eligibleDeals?.map((deal: any) => (
                  <div key={deal.id} style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: '1rem', background: '#F8FAFC' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>{deal.name}</h3>
                      <button 
                        onClick={() => {
                          applyDeal(deal);
                          setShowDealSheet(false);
                        }}
                        style={{ background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Apply
                      </button>
                    </div>
                    {deal.description && <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 8px 0' }}>{deal.description}</p>}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: '#E0E7FF', color: '#4338CA', borderRadius: 4, fontWeight: 600 }}>{deal.type.replace(/_/g, ' ')}</span>
                      {deal.minOrderValue && <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: '#F1F5F9', color: '#475569', borderRadius: 4 }}>Min PKR {deal.minOrderValue}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
