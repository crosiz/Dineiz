'use client';

import React, { useState } from 'react';
import { getCustomer, addCustomerNote, updateCustomer } from '@/lib/api/customers';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { CreateCustomerSlideOver } from './CreateCustomerSlideOver';

type LoyaltyTier = { id: string; name: string; minPoints: number; badgeColor: string };

type CustomerDetailSlideOverProps = {
  customerId: string;
  onClose: () => void;
  onUpdate: () => void;
};

export function CustomerDetailSlideOver({ customerId, onClose, onUpdate }: CustomerDetailSlideOverProps) {
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'ORDERS' | 'LOYALTY' | 'NOTES'>('PROFILE');
  const [newNote, setNewNote] = useState('');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [tiers, setTiers] = useState<LoyaltyTier[]>([]);

  React.useEffect(() => {
    async function load() {
      try {
        const [res, tiersRes] = await Promise.all([
          getCustomer(customerId),
          apiFetch<LoyaltyTier[]>('/api/loyalty/tiers').catch(() => []),
        ]);
        setCustomer(res);
        setTiers([...tiersRes].sort((a, b) => a.minPoints - b.minPoints));
      } catch (e) {
        console.error(e);
        toast.error('Failed to load customer details');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [customerId]);

  const addNote = async () => {
    if (!newNote.trim()) return;
    try {
      await addCustomerNote(customerId, newNote);
      setNewNote('');
      toast.success('Note added successfully');
      
      // Reload customer to get new note
      const res = await getCustomer(customerId);
      setCustomer(res);
      onUpdate();
    } catch (e) {
      console.error(e);
      toast.error('Failed to add note');
    }
  };

  if (loading) return (
    <div className="fixed inset-y-0 right-0 w-full md:w-[600px] bg-white shadow-2xl z-50 flex items-center justify-center border-l border-gray-100">
      <div className="flex flex-col items-center gap-4">
        <span className="material-symbols-outlined text-[#FF5722] text-4xl animate-spin">progress_activity</span>
        <span className="text-gray-500 font-medium">Loading profile...</span>
      </div>
    </div>
  );
  
  if (!customer) return null;

  // Real tier progress from the tenant's actual configured tiers — the
  // customer's own currentTier plus whichever tier is next by point
  // threshold, instead of a hardcoded "Bronze"/40%/240-points placeholder.
  const points = customer.loyaltyPoints ?? 0;
  const currentTier: LoyaltyTier | null = customer.currentTier
    ?? [...tiers].reverse().find(t => points >= t.minPoints)
    ?? null;
  const nextTier = tiers.find(t => t.minPoints > points) ?? null;
  const tierProgressPercent = nextTier && currentTier
    ? Math.min(100, Math.max(0, ((points - currentTier.minPoints) / (nextTier.minPoints - currentTier.minPoints)) * 100))
    : 100;

  return (
    <>
      <div className="fixed inset-0 bg-gray-900/20 backdrop-blur-[2px] z-40 transition-opacity" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full md:w-[640px] bg-[#f8fafc] shadow-2xl z-50 flex flex-col transform transition-transform duration-300 overflow-hidden">
        
        {/* Header Header */}
        <div className="bg-white px-8 pt-8 pb-6 border-b border-gray-100 shadow-sm relative z-10">
          <button onClick={onClose} className="absolute top-6 right-6 p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-50 rounded-full transition-colors flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>

          <div className="flex items-center gap-5">
            <div className="h-20 w-20 bg-[#FF5722]/10 text-[#FF5722] rounded-3xl flex items-center justify-center text-3xl font-bold shadow-inner">
              {customer.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-900 tracking-tight">{customer.name}</h2>
              <p className="text-sm text-gray-500 font-medium mt-1 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">call</span> {customer.phone || 'No phone'} 
                <span className="w-1 h-1 bg-gray-300 rounded-full"></span> 
                <span className="material-symbols-outlined text-[16px]">mail</span> {customer.email || 'No email'}
              </p>
              <div className="mt-3 flex gap-2">
                {currentTier && (
                  <span
                    className="px-3 py-1 text-[11px] font-bold rounded-lg uppercase tracking-wider flex items-center gap-1"
                    style={{ background: `${currentTier.badgeColor}1A`, color: currentTier.badgeColor }}
                  >
                    <span className="material-symbols-outlined text-[14px]">workspace_premium</span> {currentTier.name} Tier
                  </span>
                )}
                {customer.segment && (
                  <span className="px-3 py-1 text-[11px] font-bold rounded-lg bg-gray-100 text-gray-700 uppercase tracking-wider">
                    {customer.segment.replace('_', ' ')}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-4 gap-3 mt-8">
            <div className="bg-gray-50 rounded-2xl p-3 text-center border border-gray-100">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Orders</div>
              <div className="text-xl font-bold text-gray-900">{customer.totalOrders}</div>
            </div>
            <div className="bg-gray-50 rounded-2xl p-3 text-center border border-gray-100">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Spend</div>
              <div className="text-xl font-bold text-gray-900">PKR {customer.totalSpend.toLocaleString()}</div>
            </div>
            <div className="bg-gray-50 rounded-2xl p-3 text-center border border-gray-100">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Avg Order</div>
              <div className="text-xl font-bold text-gray-900">PKR {customer.totalOrders > 0 ? Math.round(customer.totalSpend / customer.totalOrders).toLocaleString() : 0}</div>
            </div>
            <div className="bg-[#FF5722]/10 rounded-2xl p-3 text-center border border-[#FF5722]/20">
              <div className="text-xs font-bold text-[#FF5722] uppercase tracking-wider mb-1">Points</div>
              <div className="text-xl font-bold text-[#FF5722]">{customer.loyaltyPoints}</div>
            </div>
          </div>
          
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => {
                if (!customer.phone) { toast.error('This customer has no phone number on file'); return; }
                const digits = customer.phone.replace(/[^\d]/g, '');
                window.open(`https://wa.me/${digits}`, '_blank', 'noopener,noreferrer');
              }}
              className="flex-1 py-2.5 bg-green-50 hover:bg-green-100 text-green-700 text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">chat</span> WhatsApp
            </button>
            <button onClick={() => setActiveTab('NOTES')} className="flex-1 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 border border-gray-200">
              <span className="material-symbols-outlined text-[18px]">note_add</span> Add Note
            </button>
            <button onClick={() => setIsEditOpen(true)} className="flex-1 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 border border-gray-200">
              <span className="material-symbols-outlined text-[18px]">edit</span> Edit Profile
            </button>
          </div>
        </div>
        
        {/* Navigation Tabs */}
        <div className="bg-white px-8 flex border-b border-gray-200 shadow-sm relative z-0">
          {(['PROFILE', 'ORDERS', 'LOYALTY', 'NOTES'] as const).map(tab => (
            <button 
              key={tab}
              className={`px-5 py-4 text-[13px] font-bold tracking-wider uppercase transition-colors relative ${activeTab === tab ? 'text-[#FF5722]' : 'text-gray-400 hover:text-gray-700'}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF5722] rounded-t-full"></div>
              )}
            </button>
          ))}
        </div>
        
        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 no-scrollbar bg-slate-50">
          {activeTab === 'PROFILE' && (
            <div className="space-y-6">
              <div className="bg-white rounded-3xl p-6 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] border border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 mb-5 flex items-center gap-2">
                  <span className="material-symbols-outlined text-gray-400 text-[18px]">account_circle</span> Personal Information
                </h3>
                <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                  <div>
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Full Name</label>
                    <div className="text-sm font-bold text-gray-900">{customer.name}</div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Phone Number</label>
                    <div className="text-sm font-bold text-gray-900">{customer.phone || '—'}</div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Email Address</label>
                    <div className="text-sm font-bold text-gray-900">{customer.email || '—'}</div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Birthday</label>
                    <div className="text-sm font-bold text-gray-900">{customer.birthday ? new Date(customer.birthday).toLocaleDateString() : '—'}</div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-3xl p-6 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] border border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 mb-5 flex items-center gap-2">
                  <span className="material-symbols-outlined text-gray-400 text-[18px]">sell</span> Preferences & Tags
                </h3>
                <div className="space-y-5">
                  <div>
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Internal Tags</label>
                    <div className="flex flex-wrap gap-2">
                      {customer.tags && customer.tags.length > 0 ? customer.tags.map((t: string) => (
                        <span key={t} className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg border border-gray-200">{t}</span>
                      )) : <span className="text-sm text-gray-500 font-medium">No tags added.</span>}
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">General Notes</label>
                    <p className="text-sm text-gray-700 font-medium leading-relaxed bg-gray-50 p-4 rounded-xl border border-gray-100">
                      {customer.notes || 'No general notes available.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'ORDERS' && (
            <div className="space-y-4">
              {customer.orders?.map((o: any) => (
                <div key={o.id} className="bg-white rounded-3xl p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] border border-gray-100 hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.08)] transition-all flex justify-between items-center cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400">
                      <span className="material-symbols-outlined">receipt_long</span>
                    </div>
                    <div>
                      <div className="font-bold text-gray-900 text-sm flex items-center gap-2">
                        {o.orderNumber}
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-bold rounded-md uppercase tracking-wider">
                          {o.type.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 font-medium mt-1">
                        {new Date(o.createdAt).toLocaleString()} • {o.items?.length || 0} items
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-gray-900">PKR {o.netAmount.toLocaleString()}</div>
                    <div className="text-[10px] font-bold px-2 py-0.5 bg-green-50 text-green-700 rounded-md inline-block mt-1 uppercase tracking-wider border border-green-200">
                      {o.status}
                    </div>
                  </div>
                </div>
              ))}
              {!customer.orders?.length && (
                <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm flex flex-col items-center">
                  <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
                    <span className="material-symbols-outlined text-gray-300 text-3xl">receipt_long</span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">No orders found</h3>
                  <p className="text-gray-500 mt-2 text-sm max-w-sm">This customer hasn't placed any orders yet.</p>
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'LOYALTY' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-[#FF5722] to-[#E64A19] rounded-3xl p-8 text-white relative overflow-hidden shadow-lg shadow-[#FF5722]/20">
                <span className="material-symbols-outlined absolute -right-6 -bottom-6 text-[120px] text-white opacity-10 transform -rotate-12">stars</span>
                <div className="relative z-10">
                  <div className="text-[11px] font-bold uppercase tracking-widest opacity-80 mb-2">Available Points</div>
                  <div className="text-5xl font-black mb-6">{points}</div>

                  {tiers.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold">
                        <span>{currentTier?.name ?? 'No tier yet'}</span>
                        {nextTier && <span>{nextTier.name}</span>}
                      </div>
                      <div className="w-full h-2 bg-black/20 rounded-full overflow-hidden">
                        <div className="h-full bg-white rounded-full" style={{ width: `${tierProgressPercent}%` }}></div>
                      </div>
                      <div className="text-xs font-medium opacity-90 text-right">
                        {nextTier ? `${nextTier.minPoints - points} points to ${nextTier.name}` : 'Highest tier reached'}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="bg-white rounded-3xl shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] border border-gray-100 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100">
                  <h3 className="text-sm font-bold text-gray-900">Points History</h3>
                </div>
                <div className="divide-y divide-gray-50">
                  {customer.points?.map((p: any) => (
                    <div key={p.id} className="px-6 py-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${p.points > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                          <span className="material-symbols-outlined text-[20px]">{p.points > 0 ? 'add_circle' : 'remove_circle'}</span>
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 text-sm">{p.type}</div>
                          <div className="text-xs text-gray-500 font-medium mt-0.5">
                            {new Date(p.createdAt).toLocaleDateString()} {p.reference ? `• Ref: ${p.reference}` : ''}
                          </div>
                        </div>
                      </div>
                      <div className={`font-black text-lg ${p.points > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {p.points > 0 ? '+' : ''}{p.points}
                      </div>
                    </div>
                  ))}
                  {!customer.points?.length && (
                    <div className="py-10 text-center text-gray-500 text-sm font-medium">No point transactions yet.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'NOTES' && (
            <div className="h-full flex flex-col space-y-4">
              <div className="flex-1 space-y-4 overflow-y-auto pr-2 no-scrollbar">
                {customer.staffNotes?.map((n: any) => (
                  <div key={n.id} className="bg-white p-5 rounded-3xl shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] border border-gray-100 flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0">
                      {n.staffName.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="font-bold text-gray-900 text-sm">{n.staffName}</span>
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{new Date(n.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-gray-700 font-medium leading-relaxed">{n.noteText}</p>
                    </div>
                  </div>
                ))}
                {!customer.staffNotes?.length && (
                  <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm flex flex-col items-center mt-4">
                    <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
                      <span className="material-symbols-outlined text-gray-300 text-3xl">edit_note</span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">No staff notes</h3>
                    <p className="text-gray-500 mt-2 text-sm max-w-sm">Leave notes about customer preferences, complaints, or VIP treatment.</p>
                  </div>
                )}
              </div>
              
              <div className="bg-white rounded-3xl shadow-[0_4px_24px_-8px_rgba(0,0,0,0.08)] border border-gray-100 p-2 flex items-center mt-auto shrink-0">
                <input 
                  type="text"
                  className="flex-1 px-4 py-3 bg-transparent text-sm font-medium focus:outline-none placeholder-gray-400"
                  placeholder="Type a new internal note..." 
                  value={newNote} 
                  onChange={e => setNewNote(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addNote();
                    }
                  }}
                />
                <button 
                  onClick={addNote} 
                  disabled={!newNote.trim()}
                  className="w-12 h-12 bg-[#FF5722] hover:bg-[#E64A19] text-white rounded-2xl flex items-center justify-center shadow-md disabled:opacity-50 transition-all shrink-0 ml-2"
                >
                  <span className="material-symbols-outlined text-[20px]">send</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <CreateCustomerSlideOver
        isOpen={isEditOpen}
        initialData={customer}
        onClose={() => setIsEditOpen(false)}
        onSubmit={async (data) => {
          try {
            await updateCustomer(customerId, data);
            toast.success('Customer updated');
            const res = await getCustomer(customerId);
            setCustomer(res);
            onUpdate();
          } catch (e: any) {
            toast.error(e?.message || 'Failed to update customer');
            throw e;
          }
        }}
      />
    </>
  );
}
