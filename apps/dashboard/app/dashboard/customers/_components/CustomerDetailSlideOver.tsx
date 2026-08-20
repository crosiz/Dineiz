'use client';

import React, { useState } from 'react';
import { getCustomer, addCustomerNote, updateCustomer } from '@/lib/api/customers';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { CreateCustomerSlideOver } from './CreateCustomerSlideOver';
import {
  X, Phone, Mail, Award, MessageSquare, FileText, Edit2,
  User, Tag, Receipt, PlusCircle, MinusCircle, Send, Sparkles
} from 'lucide-react';
import { PageLoader } from '@/components/ui/Spinner';

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
    <div className="fixed inset-y-0 right-0 w-full md:w-[600px] bg-white shadow-2xl z-50 flex items-center justify-center border-l border-slate-200">
      <PageLoader label="Loading profile..." />
    </div>
  );
  
  if (!customer) return null;

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
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 transition-opacity" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full md:w-[640px] bg-slate-50 shadow-2xl z-50 flex flex-col transform transition-transform duration-300 overflow-hidden">
        
        {/* Header */}
        <div className="bg-white px-6 pt-6 pb-5 border-b border-slate-200 shadow-xs relative z-10">
          <button onClick={onClose} className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors flex items-center justify-center">
            <X size={18} />
          </button>

          <div className="flex items-center gap-4">
            <div className="h-14 w-14 bg-[#FF5722]/10 text-[#FF5722] rounded-xl flex items-center justify-center text-xl font-bold border border-[#FF5722]/20">
              {customer.name ? customer.name.substring(0, 2).toUpperCase() : 'G'}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">{customer.name}</h2>
              <p className="text-xs text-slate-500 font-mono mt-0.5 flex items-center gap-2">
                <span className="flex items-center gap-1"><Phone size={12} className="text-slate-400" /> {customer.phone || 'No phone'}</span>
                <span className="w-1 h-1 bg-slate-300 rounded-full" /> 
                <span className="flex items-center gap-1"><Mail size={12} className="text-slate-400" /> {customer.email || 'No email'}</span>
              </p>
              <div className="mt-2 flex gap-1.5">
                {currentTier && (
                  <span
                    className="px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider flex items-center gap-1"
                    style={{ background: `${currentTier.badgeColor}1A`, color: currentTier.badgeColor }}
                  >
                    <Award size={11} /> {currentTier.name} Tier
                  </span>
                )}
                {customer.segment && (
                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-slate-100 text-slate-600 uppercase tracking-wider">
                    {customer.segment.replace('_', ' ')}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* Quick Metrics */}
          <div className="grid grid-cols-4 gap-2.5 mt-5">
            <div className="bg-slate-50 rounded-lg p-2.5 text-center border border-slate-200/60">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Orders</div>
              <div className="text-sm font-bold text-slate-900 font-mono">{customer.totalOrders}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-2.5 text-center border border-slate-200/60">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Spend</div>
              <div className="text-sm font-bold text-slate-900 font-mono">PKR {customer.totalSpend.toLocaleString()}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-2.5 text-center border border-slate-200/60">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Avg Order</div>
              <div className="text-sm font-bold text-slate-900 font-mono">PKR {customer.totalOrders > 0 ? Math.round(customer.totalSpend / customer.totalOrders).toLocaleString() : 0}</div>
            </div>
            <div className="bg-[#FF5722]/10 rounded-lg p-2.5 text-center border border-[#FF5722]/20">
              <div className="text-[10px] font-semibold text-[#FF5722] uppercase tracking-wider mb-0.5">Points</div>
              <div className="text-sm font-bold text-[#FF5722] font-mono">{customer.loyaltyPoints}</div>
            </div>
          </div>
          
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => {
                if (!customer.phone) { toast.error('This customer has no phone number on file'); return; }
                const digits = customer.phone.replace(/[^\d]/g, '');
                window.open(`https://wa.me/${digits}`, '_blank', 'noopener,noreferrer');
              }}
              className="flex-1 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 border border-emerald-200"
            >
              <MessageSquare size={13} /> WhatsApp
            </button>
            <button onClick={() => setActiveTab('NOTES')} className="flex-1 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 border border-slate-200 shadow-xs">
              <FileText size={13} /> Add Note
            </button>
            <button onClick={() => setIsEditOpen(true)} className="flex-1 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 border border-slate-200 shadow-xs">
              <Edit2 size={13} /> Edit Profile
            </button>
          </div>
        </div>
        
        {/* Navigation Tabs */}
        <div className="bg-white px-6 flex border-b border-slate-200">
          {(['PROFILE', 'ORDERS', 'LOYALTY', 'NOTES'] as const).map(tab => (
            <button 
              key={tab}
              className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider transition-colors relative ${activeTab === tab ? 'text-[#FF5722]' : 'text-slate-400 hover:text-slate-700'}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF5722] rounded-t-full" />
              )}
            </button>
          ))}
        </div>
        
        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-4">
          {activeTab === 'PROFILE' && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
                <h3 className="text-xs font-bold text-slate-900 mb-4 flex items-center gap-1.5">
                  <User size={14} className="text-slate-400" /> Personal Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">Full Name</label>
                    <div className="text-xs font-semibold text-slate-900">{customer.name}</div>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">Phone Number</label>
                    <div className="text-xs font-mono text-slate-900">{customer.phone || '—'}</div>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">Email Address</label>
                    <div className="text-xs font-mono text-slate-900">{customer.email || '—'}</div>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">Birthday</label>
                    <div className="text-xs text-slate-900">{customer.birthday ? new Date(customer.birthday).toLocaleDateString() : '—'}</div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
                <h3 className="text-xs font-bold text-slate-900 mb-4 flex items-center gap-1.5">
                  <Tag size={14} className="text-slate-400" /> Preferences & Tags
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Internal Tags</label>
                    <div className="flex flex-wrap gap-1.5">
                      {customer.tags && customer.tags.length > 0 ? customer.tags.map((t: string) => (
                        <span key={t} className="px-2.5 py-0.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded border border-slate-200">{t}</span>
                      )) : <span className="text-xs text-slate-400">No tags added</span>}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">General Notes</label>
                    <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                      {customer.notes || 'No general notes available.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'ORDERS' && (
            <div className="space-y-3">
              {customer.orders?.map((o: any) => (
                <div key={o.id} className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs hover:border-slate-300 transition-all flex justify-between items-center cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-400">
                      <Receipt size={16} />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 text-xs flex items-center gap-1.5">
                        {o.orderNumber}
                        <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 text-[10px] font-semibold rounded uppercase">
                          {o.type.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {new Date(o.createdAt).toLocaleDateString()} • {o.items?.length || 0} items
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-900 text-xs font-mono">PKR {o.netAmount.toLocaleString()}</div>
                    <div className="text-[10px] font-semibold px-1.5 py-0.2 bg-emerald-50 text-emerald-700 rounded inline-block mt-0.5 uppercase border border-emerald-200">
                      {o.status}
                    </div>
                  </div>
                </div>
              ))}
              {!customer.orders?.length && (
                <div className="bg-white rounded-xl p-10 text-center border border-slate-200 shadow-xs flex flex-col items-center">
                  <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center mb-3 text-slate-400">
                    <Receipt size={22} />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900">No orders found</h3>
                  <p className="text-slate-500 mt-1 text-xs max-w-sm">This customer hasn't placed any orders yet.</p>
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'LOYALTY' && (
            <div className="space-y-4">
              <div className="bg-slate-900 rounded-xl p-6 text-white relative overflow-hidden shadow-xs border border-slate-800">
                <div className="relative z-10">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Available Points</div>
                  <div className="text-3xl font-black mb-4 font-mono">{points}</div>

                  {tiers.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span>{currentTier?.name ?? 'No tier'}</span>
                        {nextTier && <span className="text-slate-400">{nextTier.name}</span>}
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-[#FF5722] rounded-full" style={{ width: `${tierProgressPercent}%` }} />
                      </div>
                      <div className="text-[11px] text-slate-400 text-right">
                        {nextTier ? `${nextTier.minPoints - points} points to ${nextTier.name}` : 'Highest tier reached'}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                  <h3 className="text-xs font-bold text-slate-900">Points History</h3>
                </div>
                <div className="divide-y divide-slate-100 text-xs">
                  {customer.points?.map((p: any) => (
                    <div key={p.id} className="px-4 py-3 flex justify-between items-center hover:bg-slate-50/60 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${p.points > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                          {p.points > 0 ? <PlusCircle size={14} /> : <MinusCircle size={14} />}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 text-xs">{p.type}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                            {new Date(p.createdAt).toLocaleDateString()} {p.reference ? `• Ref: ${p.reference}` : ''}
                          </div>
                        </div>
                      </div>
                      <div className={`font-bold font-mono ${p.points > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {p.points > 0 ? '+' : ''}{p.points}
                      </div>
                    </div>
                  ))}
                  {!customer.points?.length && (
                    <div className="py-8 text-center text-slate-400 text-xs">No point transactions recorded yet.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'NOTES' && (
            <div className="h-full flex flex-col space-y-3">
              <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                {customer.staffNotes?.map((n: any) => (
                  <div key={n.id} className="bg-white p-4 rounded-xl shadow-xs border border-slate-200 flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                      {n.staffName.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="font-semibold text-slate-900 text-xs">{n.staffName}</span>
                        <span className="text-[10px] text-slate-400">{new Date(n.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed">{n.noteText}</p>
                    </div>
                  </div>
                ))}
                {!customer.staffNotes?.length && (
                  <div className="bg-white rounded-xl p-8 text-center border border-slate-200 shadow-xs flex flex-col items-center">
                    <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center mb-2 text-slate-400">
                      <FileText size={18} />
                    </div>
                    <h3 className="text-xs font-bold text-slate-900">No staff notes</h3>
                    <p className="text-slate-500 mt-0.5 text-xs max-w-sm">Leave notes about customer preferences or VIP treatment.</p>
                  </div>
                )}
              </div>
              
              <div className="bg-white rounded-xl border border-slate-200 p-1.5 flex items-center mt-auto shrink-0 shadow-xs">
                <input 
                  type="text"
                  className="flex-1 px-3 py-1.5 bg-transparent text-xs outline-none placeholder-slate-400"
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
                  className="h-8 px-3 bg-[#FF5722] hover:bg-[#F4511E] text-white rounded-lg flex items-center justify-center disabled:opacity-50 transition-colors shrink-0 gap-1 text-xs font-semibold"
                >
                  <Send size={13} /> Add
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

