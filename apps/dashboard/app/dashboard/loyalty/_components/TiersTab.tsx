'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Button } from '@dineiz/ui/src/components/button';
import { Input } from '@dineiz/ui/src/components/input';
import { Pagination } from '@/components/ui/Pagination';

export function TiersTab() {
  const [tiers, setTiers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({ name: '', minPoints: 0, multiplier: 1, badgeColor: '#FF5722' });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const fetchTiers = async () => {
    try {
      const res = await apiFetch<any[]>('/api/loyalty/tiers');
      setTiers(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTiers();
  }, []);

  const handleSave = async () => {
    try {
      await apiFetch('/api/loyalty/tiers', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      setIsCreating(false);
      setFormData({ name: '', minPoints: 0, multiplier: 1, badgeColor: '#FF5722' });
      fetchTiers();
    } catch (e: any) {
      alert(e?.message || 'Failed to create tier');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this tier?')) return;
    try {
      await apiFetch(`/api/loyalty/tiers/${id}`, { method: 'DELETE' });
      fetchTiers();
    } catch (e: any) {
      alert(e?.message || 'Failed to delete tier');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-900">Loyalty Tiers</h2>
        <Button onClick={() => setIsCreating(true)}>Add Tier</Button>
      </div>

      {isCreating && (
        <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 space-y-4">
          <h3 className="font-bold text-gray-900">Create New Tier</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Tier Name</label>
              <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Minimum Points</label>
              <Input type="number" value={formData.minPoints} onChange={e => setFormData({ ...formData, minPoints: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Point Multiplier (e.g. 1.5)</label>
              <Input type="number" step="0.1" value={formData.multiplier} onChange={e => setFormData({ ...formData, multiplier: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Badge Color</label>
              <input type="color" value={formData.badgeColor} onChange={e => setFormData({ ...formData, badgeColor: e.target.value })} className="w-full h-10 rounded border border-gray-200" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save Tier</Button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-slate-100 text-[11px] uppercase text-slate-500 font-bold tracking-wider">
              <tr>
                <th className="py-4 px-6">Tier Name</th>
                <th className="py-4 px-6">Minimum Points</th>
                <th className="py-4 px-6">Multiplier</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tiers.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((tier) => (
                <tr key={tier.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                  <td className="py-4 px-6">
                    <span className="px-2.5 py-1 text-[12px] font-bold uppercase rounded" style={{ backgroundColor: `${tier.badgeColor}15`, color: tier.badgeColor }}>
                      {tier.name}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-[13px] font-bold text-slate-900">{tier.minPoints} pts</td>
                  <td className="py-4 px-6 text-[13px] font-bold text-[#FF5722]">{tier.multiplier}x</td>
                  <td className="py-4 px-6 text-right">
                    <button onClick={() => handleDelete(tier.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-colors">
                      <span className="material-symbols-outlined text-[20px]">delete</span>
                    </button>
                  </td>
                </tr>
              ))}
              {tiers.length === 0 && !isCreating && (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-500">
                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <span className="material-symbols-outlined text-slate-300 text-3xl">military_tech</span>
                    </div>
                    <h3 className="text-[13px] font-bold text-slate-900">No tiers configured</h3>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {tiers.length > 0 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-[13px] text-slate-500 bg-white">
            <div>
              Showing <span className="font-bold text-slate-900">{(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, tiers.length)}</span> of <span className="font-bold text-slate-900">{tiers.length}</span> tiers
            </div>
            <Pagination 
              currentPage={currentPage} 
              totalPages={Math.max(1, Math.ceil(tiers.length / pageSize))} 
              onPageChange={setCurrentPage} 
              pageSize={pageSize}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
