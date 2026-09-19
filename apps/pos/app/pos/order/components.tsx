'use client';

import { useState } from 'react';
import type { CachedMenuItem } from '@/lib/db';
import { useCartStore } from '@/lib/store';
import { useBrandingStore } from '@/lib/branding-store';
import { getToken } from '@/lib/pos-session';
import { API_URL } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { formatPKR } from '@/lib/utils';
import { CheckSquare, Circle, CircleDot, Square, X } from 'lucide-react';

// ─── Variation Picker Bottom Sheet ──────────────────────────────
export function VariationPicker({ item, onClose }: { item: CachedMenuItem; onClose: () => void }) {
  const addItem = useCartStore((s) => s.addItem);
  const [selectedVarId, setSelectedVarId] = useState<string | null>(item.variations?.[0]?.id || null);
  const [selectedAddOnIds, setSelectedAddOnIds] = useState<Set<string>>(new Set());

  const handleAdd = () => {
    const variation = item.variations?.find((v) => v.id === selectedVarId);
    const selectedAddOns = item.addOns?.filter((a) => selectedAddOnIds.has(a.id)) || [];
    const addOnTotal = selectedAddOns.reduce((sum, a) => sum + a.price, 0);

    addItem({
      itemId: item.id,
      name: item.name,
      basePrice: item.basePrice,
      unitPrice: item.basePrice + (variation?.price || 0) + addOnTotal,
      selectedVariation: variation,
      selectedAddOns: selectedAddOns,
      image: item.image,
    });
    onClose();
  };

  const currentTotal = item.basePrice
    + (item.variations?.find(v => v.id === selectedVarId)?.price || 0)
    + Array.from(selectedAddOnIds).reduce((sum, id) => sum + (item.addOns?.find(a => a.id === id)?.price || 0), 0);

  return (
    <Modal isOpen onClose={onClose} label={`Options for ${item.name}`} sheetOnMobile className="max-w-[600px]">
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-line p-4 sm:p-5">
            <div className="min-w-0">
              <p className="mb-1 text-xs font-medium text-ink-3">{item.categoryName || 'Menu item'}</p>
              <h2 className="text-lg font-semibold leading-6 tracking-tight text-ink">{item.name}</h2>
              <p className="mt-2 text-sm text-ink-2 tabular-nums">From {formatPKR(item.basePrice)}</p>
            </div>
            <button type="button" aria-label="Close item options" onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-canvas"><X size={20} /></button>
          </header>

          {/* Main Content Area */}
          <main className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-5 py-5 space-y-6">
            {/* 1. Choose Size (Single Select) */}
            {!!item.variations?.length && <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-ink">Choose Size</h3>
                <span className="bg-brand/10 text-brand text-[11px] font-bold px-2 py-1 rounded uppercase tracking-wide">Required</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {item.variations?.map((v) => (
                  <label
                    key={v.id}
                    className={`relative flex items-center justify-between min-h-[68px] gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-brand focus-within:ring-offset-2 ${selectedVarId === v.id ? 'border border-brand bg-brand-soft' : 'border border-line bg-white hover:bg-canvas'}`}
                  >
                    <input
                      type="radio"
                      name="size"
                      checked={selectedVarId === v.id}
                      onChange={() => setSelectedVarId(v.id)}
                      className="sr-only"
                    />
                    <div className="flex flex-col">
                      <span className="text-[15px] font-medium text-ink">{v.name}</span>
                      {v.price > 0 && <span className="text-[12px] font-bold text-brand">+ {formatPKR(v.price)}</span>}
                    </div>
                    {selectedVarId === v.id
                      ? <CircleDot className="w-6 h-6 text-brand" />
                      : <Circle className="w-6 h-6 text-ink-4" />}
                  </label>
                ))}
              </div>
            </section>}

            {/* 2. Choose Add-ons (Multi Select) */}
            {item.addOns && item.addOns.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-ink">Add Extras</h3>
                  <span className="bg-sunken text-ink-3 text-[11px] font-bold px-2 py-1 rounded uppercase tracking-wide">Optional</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {item.addOns.map((a) => (
                    <label
                      key={a.id}
                      className={`relative flex items-center justify-between min-h-[68px] gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-brand focus-within:ring-offset-2 ${selectedAddOnIds.has(a.id) ? 'border border-brand bg-brand-soft' : 'border border-line bg-white hover:bg-canvas'}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedAddOnIds.has(a.id)}
                        onChange={(e) => {
                          const newSet = new Set(selectedAddOnIds);
                          if (e.target.checked) newSet.add(a.id);
                          else newSet.delete(a.id);
                          setSelectedAddOnIds(newSet);
                        }}
                        className="sr-only"
                      />
                      <div className="flex flex-col">
                        <span className="text-[15px] font-medium text-ink">{a.name}</span>
                        {a.price > 0 && <span className="text-[12px] font-bold text-brand">+ {formatPKR(a.price)}</span>}
                      </div>
                      {selectedAddOnIds.has(a.id)
                        ? <CheckSquare className="w-6 h-6 text-brand" />
                        : <Square className="w-6 h-6 text-ink-4" />}
                    </label>
                  ))}
                </div>
              </section>
            )}
          </main>

          <footer className="shrink-0 border-t border-line bg-surface p-4 sm:p-5">
            <button type="button" onClick={handleAdd} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-on-brand hover:bg-brand-strong">
              <span>Add to order</span><span className="tabular-nums">{formatPKR(currentTotal)}</span>
            </button>
          </footer>
    </Modal>
  );
}

// ─── Discount Modal ────────────────────────────────────────────
export function DiscountModal({ onClose }: { onClose: () => void }) {
  const setDiscount = useCartStore((s) => s.setDiscount);
  const session = useCartStore((s) => s.session);
  const subtotal = useCartStore((s) => s.subtotal());
  const [type, setType] = useState<'percent' | 'fixed'>('percent');
  const [value, setValue] = useState('');
  const [pin, setPin] = useState('');
  const [reason, setReason] = useState('');
  const [pinError, setPinError] = useState('');
  const [verifying, setVerifying] = useState(false);

  const isManager = session?.role === 'BRANCH_MANAGER' || session?.role === 'TENANT_ADMIN';
  // Tenant-configured ceiling (Settings → Point of Sale); 0 if never set, which
  // correctly requires approval for any manual discount — matching
  // allowCashierDiscounts' own default of false for an unconfigured tenant.
  const maxDiscountPercent = useBrandingStore((s) => s.branding?.pos?.maxDiscountPercent ?? 0);
  const numValue = parseFloat(value || '0');
  // A fixed amount was previously exempt from this check entirely — switching
  // the discount type to "Fixed Amount" needed no PIN/reason at any value, so
  // a cashier could zero out any bill with zero approval. Converting it to
  // the equivalent percentage of the same subtotal the discount is actually
  // applied against (store.discountAmount() uses this same `subtotal()`)
  // makes both discount types answer to the one real limit.
  const effectivePercent = type === 'percent'
    ? numValue
    : (subtotal > 0 ? (numValue / subtotal) * 100 : (numValue > 0 ? Infinity : 0));
  const needsOverride = effectivePercent > maxDiscountPercent;

  const handleApply = async () => {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) return;

    if (needsOverride) {
      if (!isManager) {
        if (pin.length !== 4) {
          setPinError('Enter the 4-digit manager PIN.');
          return;
        }
        setVerifying(true);
        setPinError('');
        try {
          const res = await fetch(`${API_URL}/api/pos/auth/validate-manager-pin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body: JSON.stringify({ pin, branchId: session?.branchId }),
          });
          if (!res.ok) {
            setPinError('Incorrect manager PIN.');
            setVerifying(false);
            return;
          }
        } catch {
          setPinError('Could not verify PIN — check your connection.');
          setVerifying(false);
          return;
        }
        setVerifying(false);
      } else if (!reason.trim()) {
        setPinError(`A reason is required for discounts over ${maxDiscountPercent}%.`);
        return;
      }
    }

    setDiscount({ type, value: num, label: reason.trim() || 'Manual Discount' });
    onClose();
  };

  return (
    <Modal isOpen onClose={verifying ? undefined : onClose} label="Apply discount" className="max-w-md">
      <div className="p-5 overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-ink">Apply Discount</h2>
          <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-ink-4 hover:bg-sunken hover:text-ink transition-colors">
            <X className="w-[20px] h-[20px]" />
          </button>
        </div>

        <div className="flex gap-2 mb-6 p-1 bg-sunken rounded-xl border border-line">
          <button
            type="button"
            onClick={() => setType('percent')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${type === 'percent' ? 'bg-white text-ink shadow-sm' : 'text-ink-3 hover:text-ink'}`}
          >
            Percentage (%)
          </button>
          <button
            type="button"
            onClick={() => setType('fixed')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${type === 'fixed' ? 'bg-white text-ink shadow-sm' : 'text-ink-3 hover:text-ink'}`}
          >
            Fixed Amount
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-bold text-ink-3 uppercase tracking-wider mb-1.5 block">Discount Value</label>
            <input
              type="number"
              value={value}
              onChange={(e) => { setValue(e.target.value); setPinError(''); }}
              placeholder={type === 'percent' ? 'e.g., 10' : 'e.g., 500'}
              className="w-full bg-canvas border border-line rounded-xl p-3 text-ink font-semibold placeholder:text-ink-4 focus:border-brand focus:bg-white outline-none transition-colors"
            />
          </div>

          {needsOverride && (
            <div className="animate-in slide-in-from-top-1 duration-200">
              {!isManager ? (
                <>
                  <label className="text-[11px] font-bold text-danger uppercase tracking-wider mb-1.5 block">Manager PIN required — discount over {maxDiscountPercent}%</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={pin}
                    onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setPinError(''); }}
                    placeholder="Enter 4-digit PIN"
                    className="w-full bg-danger/10 border border-danger rounded-xl p-3 text-ink font-semibold tracking-widest placeholder:text-[#C99] focus:border-danger outline-none transition-colors"
                  />
                </>
              ) : (
                <>
                  <label className="text-[11px] font-bold text-brand-strong uppercase tracking-wider mb-1.5 block">Reason required — discount over {maxDiscountPercent}%</label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => { setReason(e.target.value); setPinError(''); }}
                    placeholder="e.g. Customer complaint, VIP"
                    className="w-full bg-brand-soft border border-brand/30 rounded-xl p-3 text-ink font-semibold placeholder:text-[#B99] focus:border-brand outline-none transition-colors"
                  />
                </>
              )}
              {pinError && <p className="text-[12px] font-semibold text-danger mt-1.5">{pinError}</p>}
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-7">
          <button type="button" onClick={onClose} className="flex-1 p-3 rounded-xl border border-line text-ink-2 font-bold hover:bg-sunken transition-colors">Cancel</button>
          <button
            type="button"
            onClick={handleApply}
            disabled={verifying || !value}
            className="flex-1 p-3 rounded-xl bg-brand hover:brightness-105 active:scale-[0.98] disabled:opacity-50 text-white font-bold transition-all shadow-lg shadow-brand/25"
          >
            {verifying ? 'Verifying…' : 'Apply Discount'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
