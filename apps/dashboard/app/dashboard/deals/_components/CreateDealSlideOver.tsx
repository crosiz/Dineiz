import React, { useState } from 'react';
import { Percent, Coins, ShoppingBag, Clock, Utensils, Gift, X, Loader2 } from 'lucide-react';

type CreateDealSlideOverProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (dealData: any) => Promise<void>;
  items: { id: string; name: string }[];
  categories: { id: string; name: string }[];
};

const InputField = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input 
    {...props} 
    className={`w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs transition-all focus:outline-none focus:ring-1 focus:ring-[#FF5722] focus:border-[#FF5722] ${props.className || ''}`}
  />
);

const SelectField = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select 
    {...props} 
    className={`w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs transition-all focus:outline-none focus:ring-1 focus:ring-[#FF5722] focus:border-[#FF5722] appearance-none ${props.className || ''}`}
  >
    {props.children}
  </select>
);

export function CreateDealSlideOver({ isOpen, onClose, onSubmit, items, categories }: CreateDealSlideOverProps) {
  const [dealType, setDealType] = useState('PERCENT');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  // Values specific to types
  const [percent, setPercent] = useState<number>(0);
  const [maxDiscount, setMaxDiscount] = useState<number | ''>('');
  const [fixedAmount, setFixedAmount] = useState<number>(0);
  const [minOrderValue, setMinOrderValue] = useState<number | ''>('');
  
  // BxGy
  const [buyItemId, setBuyItemId] = useState('');
  const [buyQty, setBuyQty] = useState(1);
  const [getItemId, setGetItemId] = useState('');
  const [getQty, setGetQty] = useState(1);

  // Happy Hour
  const [validTimeStart, setValidTimeStart] = useState('14:00');
  const [validTimeEnd, setValidTimeEnd] = useState('17:00');
  const [happyHourPercent, setHappyHourPercent] = useState(20);

  // Combo Price
  const [comboPrice, setComboPrice] = useState<number>(0);
  const [comboItemId1, setComboItemId1] = useState('');
  const [comboItemId2, setComboItemId2] = useState('');

  // Free Item
  const [freeItemId, setFreeItemId] = useState('');
  const [freeItemQty, setFreeItemQty] = useState(1);

  // Conditions
  const [autoApply, setAutoApply] = useState(false);
  const [requiresPromoCode, setRequiresPromoCode] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [allowStacking, setAllowStacking] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!name) return;

    let config: any = {};
    if (dealType === 'PERCENT') {
      config = { percent, maxDiscount: maxDiscount || undefined };
    } else if (dealType === 'FIXED') {
      config = { amount: fixedAmount };
    } else if (dealType === 'BUY_X_GET_Y') {
      config = { buyItemId, buyQty, getItemId, getQty };
    } else if (dealType === 'HAPPY_HOUR') {
      config = { percent: happyHourPercent, startTime: validTimeStart, endTime: validTimeEnd };
    } else if (dealType === 'COMBO_PRICE') {
      config = { price: comboPrice, itemIds: [comboItemId1, comboItemId2].filter(Boolean) };
    } else if (dealType === 'FREE_ITEM') {
      config = { freeItemId, quantity: freeItemQty };
    }

    const payload = {
      name,
      description,
      type: dealType === 'FIXED' ? 'FIXED_AMOUNT' : dealType,
      config,
      minOrderValue: minOrderValue || undefined,
      autoApply,
      requiresPromoCode,
      promoCode: requiresPromoCode ? promoCode : undefined,
      allowStacking,
      isActive: true,
    };

    setLoading(true);
    try {
      await onSubmit(payload);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" onClick={onClose} />
      
      <div className="relative w-full max-w-[540px] bg-white h-full shadow-xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">Create Deal</h2>
            <p className="text-xs text-slate-500 mt-0.5">Configure a new promotion or discount</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Section 1 - Type */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Promotion Type</h3>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { type: 'PERCENT', icon: Percent, label: 'Percentage' },
                { type: 'FIXED', icon: Coins, label: 'Fixed Amount' },
                { type: 'BUY_X_GET_Y', icon: ShoppingBag, label: 'Buy X Get Y' },
                { type: 'HAPPY_HOUR', icon: Clock, label: 'Happy Hour' },
                { type: 'COMBO_PRICE', icon: Utensils, label: 'Combo' },
                { type: 'FREE_ITEM', icon: Gift, label: 'Free Item' },
              ].map(t => {
                const IconComponent = t.icon;
                return (
                  <button
                    key={t.type}
                    onClick={() => setDealType(t.type)}
                    className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg border transition-all ${
                      dealType === t.type 
                        ? 'border-[#FF5722] bg-[#FF5722]/10 text-[#FF5722] font-semibold' 
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <IconComponent size={18} />
                    <span className="text-xs">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Section 2 - Basic Info */}
          <section className="space-y-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Basic Details</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Deal Name *</label>
              <InputField placeholder="e.g. 20% Off Weekend Special" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
              <InputField placeholder="Brief info visible to staff/customers" value={description} onChange={e => setDescription(e.target.value)} />
            </div>
          </section>

          {/* Section 3 - Dynamic Form based on Type */}
          <section className="space-y-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Deal Parameters</h3>

            {dealType === 'PERCENT' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Discount % *</label>
                  <InputField type="number" placeholder="20" value={percent || ''} onChange={e => setPercent(Number(e.target.value))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Max Cap (PKR)</label>
                  <InputField type="number" placeholder="Optional" value={maxDiscount} onChange={e => setMaxDiscount(Number(e.target.value))} />
                </div>
              </div>
            )}

            {dealType === 'FIXED' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Discount Amount (PKR) *</label>
                <InputField type="number" placeholder="500" value={fixedAmount || ''} onChange={e => setFixedAmount(Number(e.target.value))} />
              </div>
            )}

            {dealType === 'BUY_X_GET_Y' && (
              <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Buy Item</label>
                    <SelectField value={buyItemId} onChange={e => setBuyItemId(e.target.value)}>
                      <option value="">Select Item</option>
                      {items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </SelectField>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Qty</label>
                    <InputField type="number" min="1" value={buyQty} onChange={e => setBuyQty(Number(e.target.value))} />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Get Free Item</label>
                    <SelectField value={getItemId} onChange={e => setGetItemId(e.target.value)}>
                      <option value="">Select Item</option>
                      {items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </SelectField>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Qty</label>
                    <InputField type="number" min="1" value={getQty} onChange={e => setGetQty(Number(e.target.value))} />
                  </div>
                </div>
              </div>
            )}

            {dealType === 'HAPPY_HOUR' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Discount %</label>
                  <InputField type="number" value={happyHourPercent} onChange={e => setHappyHourPercent(Number(e.target.value))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Start Time</label>
                    <InputField type="time" value={validTimeStart} onChange={e => setValidTimeStart(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">End Time</label>
                    <InputField type="time" value={validTimeEnd} onChange={e => setValidTimeEnd(e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {dealType === 'COMBO_PRICE' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Item 1</label>
                    <SelectField value={comboItemId1} onChange={e => setComboItemId1(e.target.value)}>
                      <option value="">Select Item</option>
                      {items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </SelectField>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Item 2</label>
                    <SelectField value={comboItemId2} onChange={e => setComboItemId2(e.target.value)}>
                      <option value="">Select Item</option>
                      {items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </SelectField>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Combo Total Price (PKR)</label>
                  <InputField type="number" placeholder="1200" value={comboPrice || ''} onChange={e => setComboPrice(Number(e.target.value))} />
                </div>
              </div>
            )}

            {dealType === 'FREE_ITEM' && (
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Free Item</label>
                  <SelectField value={freeItemId} onChange={e => setFreeItemId(e.target.value)}>
                    <option value="">Select Item</option>
                    {items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </SelectField>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Qty</label>
                  <InputField type="number" min="1" value={freeItemQty} onChange={e => setFreeItemQty(Number(e.target.value))} />
                </div>
              </div>
            )}
          </section>

          {/* Section 4 - Conditions */}
          <section className="space-y-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Conditions & Rules</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Minimum Order Value (PKR)</label>
              <InputField type="number" placeholder="e.g. 1000" value={minOrderValue} onChange={e => setMinOrderValue(Number(e.target.value))} />
            </div>

            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" className="mt-0.5 rounded border-slate-300 text-[#FF5722] focus:ring-[#FF5722]" checked={autoApply} onChange={e => setAutoApply(e.target.checked)} />
                <div>
                  <p className="font-semibold text-slate-900 text-xs">Auto-apply at POS</p>
                  <p className="text-[11px] text-slate-500">Applies automatically when cart qualifies</p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" className="mt-0.5 rounded border-slate-300 text-[#FF5722] focus:ring-[#FF5722]" checked={requiresPromoCode} onChange={e => setRequiresPromoCode(e.target.checked)} />
                <div className="w-full">
                  <p className="font-semibold text-slate-900 text-xs">Require Promo Code</p>
                  {requiresPromoCode && (
                    <div className="mt-2">
                      <InputField placeholder="e.g. SUMMER20" value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())} />
                    </div>
                  )}
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" className="mt-0.5 rounded border-slate-300 text-[#FF5722] focus:ring-[#FF5722]" checked={allowStacking} onChange={e => setAllowStacking(e.target.checked)} />
                <div>
                  <p className="font-semibold text-slate-900 text-xs">Allow Stacking</p>
                  <p className="text-[11px] text-slate-500">Can be combined with other ongoing promotions</p>
                </div>
              </label>
            </div>
          </section>

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-2.5">
          <button 
            className="h-9 px-4 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
            onClick={onClose} 
            disabled={loading}
          >
            Cancel
          </button>
          <button 
            className="h-9 px-5 bg-[#FF5722] hover:bg-[#F4511E] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 min-w-[120px]"
            onClick={handleSubmit} 
            disabled={loading || !name.trim()}
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : 'Save Deal'}
          </button>
        </div>
      </div>
    </div>
  );
}
