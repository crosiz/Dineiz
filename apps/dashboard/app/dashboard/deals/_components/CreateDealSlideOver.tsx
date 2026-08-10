import React, { useState } from 'react';

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
    className={`w-full h-12 px-4 bg-gray-50/50 border border-gray-200 rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#FF5722]/20 focus:border-[#FF5722] focus:bg-white ${props.className || ''}`}
  />
);

const SelectField = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select 
    {...props} 
    className={`w-full h-12 px-4 bg-gray-50/50 border border-gray-200 rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#FF5722]/20 focus:border-[#FF5722] focus:bg-white appearance-none ${props.className || ''}`}
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
  const [requiresManagerApproval, setRequiresManagerApproval] = useState(false);
  const [allowStacking, setAllowStacking] = useState(false);
  
  // Promo code
  const [requiresPromoCode, setRequiresPromoCode] = useState(false);
  const [promoCode, setPromoCode] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async () => {
    setLoading(true);
    let config: any = {};
    if (dealType === 'PERCENT') {
      config = { percent, maxDiscount: maxDiscount || null };
    } else if (dealType === 'FIXED') {
      config = { amount: fixedAmount };
    } else if (dealType === 'BUY_X_GET_Y') {
      config = { buyItemId, buyQty, getItemId, getQty };
    } else if (dealType === 'HAPPY_HOUR') {
      config = { percent: happyHourPercent };
    } else if (dealType === 'COMBO_PRICE') {
      config = { price: comboPrice, items: [{ itemId: comboItemId1, qty: 1 }, { itemId: comboItemId2, qty: 1 }].filter(i => i.itemId) };
    } else if (dealType === 'FREE_ITEM') {
      config = { itemId: freeItemId, qty: freeItemQty };
    }
    
    await onSubmit({
      name,
      description,
      type: dealType,
      config,
      validTimeStart: dealType === 'HAPPY_HOUR' ? validTimeStart : null,
      validTimeEnd: dealType === 'HAPPY_HOUR' ? validTimeEnd : null,
      minOrderValue: minOrderValue || null,
      autoApply,
      requiresManagerApproval,
      allowStacking,
      requiresPromoCode,
      promoCode: requiresPromoCode ? promoCode : null,
      isActive: true,
    });
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end font-sans">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      {/* Slide-over panel */}
      <div className="relative w-full max-w-[540px] bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300 rounded-l-3xl">
        
        {/* Header */}
        <div className="px-8 py-6 flex items-center justify-between border-b border-gray-100">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Create Deal</h2>
            <p className="text-sm text-gray-500 mt-1 font-medium">Configure a new promotion or discount</p>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-10 scrollbar-hide">
          
          {/* Section 1 - Type */}
          <section className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Promotion Type</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { type: 'PERCENT', icon: 'percent', label: 'Percentage' },
                { type: 'FIXED', icon: 'payments', label: 'Fixed Amount' },
                { type: 'BUY_X_GET_Y', icon: 'shopping_bag', label: 'Buy X Get Y' },
                { type: 'HAPPY_HOUR', icon: 'schedule', label: 'Happy Hour' },
                { type: 'COMBO_PRICE', icon: 'fastfood', label: 'Combo' },
                { type: 'FREE_ITEM', icon: 'redeem', label: 'Free Item' },
              ].map(t => (
                <button
                  key={t.type}
                  onClick={() => setDealType(t.type)}
                  className={`flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border transition-all ${
                    dealType === t.type 
                      ? 'border-[#FF5722] bg-[#FF5722]/5 text-[#FF5722] shadow-[0_0_0_1px_#FF5722]' 
                      : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span className="material-symbols-outlined text-2xl">{t.icon}</span>
                  <span className="text-xs font-semibold">{t.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Section 2 - Basic Info */}
          <section className="space-y-5">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Basic Details</h3>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Deal Name</label>
              <InputField placeholder="e.g. 20% Weekend Deal" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Internal Notes</label>
              <InputField placeholder="Optional description for staff" value={description} onChange={e => setDescription(e.target.value)} />
            </div>
          </section>

          {/* Section 3 - Value Config */}
          <section className="space-y-5">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Value Configuration</h3>
            
            {dealType === 'PERCENT' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Discount %</label>
                  <InputField type="number" placeholder="20" value={percent || ''} onChange={e => setPercent(Number(e.target.value))} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Max Cap (PKR)</label>
                  <InputField type="number" placeholder="e.g. 500" value={maxDiscount} onChange={e => setMaxDiscount(Number(e.target.value))} />
                </div>
              </div>
            )}

            {dealType === 'FIXED' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Discount Amount (PKR)</label>
                <InputField type="number" placeholder="200" value={fixedAmount || ''} onChange={e => setFixedAmount(Number(e.target.value))} />
              </div>
            )}

            {dealType === 'BUY_X_GET_Y' && (
              <div className="space-y-4 p-5 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="grid grid-cols-3 gap-4 items-end">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 mb-2">Buy Item</label>
                    <SelectField value={buyItemId} onChange={e => setBuyItemId(e.target.value)}>
                      <option value="">Select item...</option>
                      {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </SelectField>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-2">Qty</label>
                    <InputField type="number" value={buyQty} onChange={e => setBuyQty(Number(e.target.value))} />
                  </div>
                </div>
                <div className="w-full flex justify-center py-1">
                  <span className="material-symbols-outlined text-gray-300">arrow_downward</span>
                </div>
                <div className="grid grid-cols-3 gap-4 items-end">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 mb-2">Get Item</label>
                    <SelectField value={getItemId} onChange={e => setGetItemId(e.target.value)}>
                      <option value="">Select item...</option>
                      {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </SelectField>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-2">Qty</label>
                    <InputField type="number" value={getQty} onChange={e => setGetQty(Number(e.target.value))} />
                  </div>
                </div>
              </div>
            )}

            {dealType === 'HAPPY_HOUR' && (
              <div className="space-y-4 p-5 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Start Time</label>
                    <InputField type="time" value={validTimeStart} onChange={e => setValidTimeStart(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">End Time</label>
                    <InputField type="time" value={validTimeEnd} onChange={e => setValidTimeEnd(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Discount %</label>
                  <InputField type="number" placeholder="20" value={happyHourPercent} onChange={e => setHappyHourPercent(Number(e.target.value))} />
                </div>
              </div>
            )}

            {dealType === 'COMBO_PRICE' && (
              <div className="space-y-4 p-5 bg-gray-50 rounded-2xl border border-gray-100">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Item 1</label>
                  <SelectField value={comboItemId1} onChange={e => setComboItemId1(e.target.value)}>
                    <option value="">Select item...</option>
                    {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </SelectField>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Item 2</label>
                  <SelectField value={comboItemId2} onChange={e => setComboItemId2(e.target.value)}>
                    <option value="">Select item...</option>
                    {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </SelectField>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Special Combo Price (PKR)</label>
                  <InputField type="number" placeholder="e.g. 500" value={comboPrice || ''} onChange={e => setComboPrice(Number(e.target.value))} />
                </div>
              </div>
            )}

            {dealType === 'FREE_ITEM' && (
              <div className="space-y-4 p-5 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="grid grid-cols-3 gap-4 items-end">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 mb-2">Free Item</label>
                    <SelectField value={freeItemId} onChange={e => setFreeItemId(e.target.value)}>
                      <option value="">Select item...</option>
                      {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </SelectField>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-2">Qty</label>
                    <InputField type="number" value={freeItemQty} onChange={e => setFreeItemQty(Number(e.target.value))} />
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Section 4 - Conditions */}
          <section className="space-y-5">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Conditions & Rules</h3>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Minimum Order Value (PKR)</label>
              <InputField type="number" placeholder="e.g. 1000" value={minOrderValue} onChange={e => setMinOrderValue(Number(e.target.value))} />
            </div>

            <div className="space-y-4 bg-gray-50 p-5 rounded-2xl border border-gray-100">
              <label className="flex items-start gap-3 cursor-pointer">
                <div className="mt-0.5 relative flex items-center justify-center">
                  <input type="checkbox" className="peer appearance-none w-5 h-5 border-2 border-gray-300 rounded-md checked:bg-[#FF5722] checked:border-[#FF5722] transition-all" checked={autoApply} onChange={e => setAutoApply(e.target.checked)} />
                  <span className="material-symbols-outlined text-white text-[14px] absolute pointer-events-none opacity-0 peer-checked:opacity-100">check</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">Auto-apply at POS</p>
                  <p className="text-xs text-gray-500 mt-0.5">Applies automatically if cart meets conditions.</p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <div className="mt-0.5 relative flex items-center justify-center">
                  <input type="checkbox" className="peer appearance-none w-5 h-5 border-2 border-gray-300 rounded-md checked:bg-[#FF5722] checked:border-[#FF5722] transition-all" checked={requiresPromoCode} onChange={e => setRequiresPromoCode(e.target.checked)} />
                  <span className="material-symbols-outlined text-white text-[14px] absolute pointer-events-none opacity-0 peer-checked:opacity-100">check</span>
                </div>
                <div className="w-full">
                  <p className="font-semibold text-gray-900 text-sm">Require Promo Code</p>
                  {requiresPromoCode && (
                    <div className="mt-3">
                      <InputField placeholder="e.g. SUMMER20" value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())} />
                    </div>
                  )}
                </div>
              </label>
            </div>
            
            <div className="space-y-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <div className="mt-0.5 relative flex items-center justify-center">
                  <input type="checkbox" className="peer appearance-none w-5 h-5 border-2 border-gray-300 rounded-md checked:bg-[#FF5722] checked:border-[#FF5722] transition-all" checked={allowStacking} onChange={e => setAllowStacking(e.target.checked)} />
                  <span className="material-symbols-outlined text-white text-[14px] absolute pointer-events-none opacity-0 peer-checked:opacity-100">check</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">Allow Stacking</p>
                  <p className="text-xs text-gray-500 mt-0.5">Allow this deal to be used with other deals on the same order.</p>
                </div>
              </label>
            </div>
          </section>

        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
          <button 
            className="px-6 py-3 bg-white border border-gray-200 text-gray-700 font-semibold rounded-full hover:bg-gray-50 transition-colors"
            onClick={onClose} 
            disabled={loading}
          >
            Cancel
          </button>
          <button 
            className="px-8 py-3 bg-[#FF5722] hover:bg-[#E64A19] text-white font-semibold rounded-full shadow-[0_8px_16px_rgba(255,87,34,0.3)] hover:shadow-[0_12px_24px_rgba(255,87,34,0.4)] transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 min-w-[140px]"
            onClick={handleSubmit} 
            disabled={loading || !name.trim()}
          >
            {loading && (
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {loading ? 'Saving...' : 'Save Deal'}
          </button>
        </div>
      </div>
    </div>
  );
}
