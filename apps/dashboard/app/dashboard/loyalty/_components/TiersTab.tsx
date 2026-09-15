'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Button } from '@dineiz/ui/src/components/button';
import { Input } from '@dineiz/ui/src/components/input';
import { Pagination } from '@/components/ui/Pagination';
import { SkeletonList } from '@/components/ui/skeleton';
import { Trash2, Award, Plus } from 'lucide-react';

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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/loyalty/tiers', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      setIsCreating(false);
      setFormData({ name: '', minPoints: 0, multiplier: 1, badgeColor: '#FF5722' });
      fetchTiers();
    } catch (e) {
      alert('Failed to create tier');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await apiFetch(`/api/loyalty/tiers/${id}`, {
        method: 'DELETE',
      });
      fetchTiers();
    } catch (e) {
      alert('Failed to delete tier');
    }
  };

  if (loading) return <SkeletonList rows={4} />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Membership Tiers</h2>
          <p className="text-xs text-slate-500 mt-0.5">Define progression milestones and point multipliers</p>
        </div>
        {!isCreating && (
          <button 
            onClick={() => setIsCreating(true)}
            className="h-9 px-3.5 bg-[#FF5722] hover:bg-[#F4511E] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Plus size={15} /> Add Tier
          </button>
        )}
      </div>

      {isCreating && (
        <form onSubmit={handleCreate} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
          <h3 className="text-xs font-bold text-slate-900">New Tier Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tier Name</label>
              <Input
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Gold"
                className="bg-white text-xs h-8"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Min Points</label>
              <Input
                type="number"
                required
                value={formData.minPoints}
                onChange={(e) => setFormData({ ...formData, minPoints: Number(e.target.value) })}
                className="bg-white text-xs h-8"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Multiplier (e.g. 1.5x)</label>
              <Input
                type="number"
                step="0.1"
                required
                value={formData.multiplier}
                onChange={(e) => setFormData({ ...formData, multiplier: Number(e.target.value) })}
                className="bg-white text-xs h-8"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Badge Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={formData.badgeColor}
                  onChange={(e) => setFormData({ ...formData, badgeColor: e.target.value })}
                  className="h-8 w-12 rounded border border-slate-200 cursor-pointer p-0.5"
                />
                <span className="text-xs font-mono text-slate-600 uppercase">{formData.badgeColor}</span>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="h-8 px-3 text-xs font-semibold rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-8 px-4 text-xs font-semibold rounded-lg bg-[#FF5722] hover:bg-[#F4511E] text-white shadow-xs"
            >
              Save Tier
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50 text-slate-500 font-semibold">
              <tr>
                <th className="py-3 px-5">Tier</th>
                <th className="py-3 px-5">Minimum Points</th>
                <th className="py-3 px-5">Multiplier</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tiers.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((tier) => (
                <tr key={tier.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-5">
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded" style={{ backgroundColor: `${tier.badgeColor}15`, color: tier.badgeColor }}>
                      {tier.name}
                    </span>
                  </td>
                  <td className="py-3 px-5 font-mono font-bold text-slate-900">{tier.minPoints} pts</td>
                  <td className="py-3 px-5 font-mono font-bold text-[#FF5722]">{tier.multiplier}x</td>
                  <td className="py-3 px-5 text-right">
                    <button onClick={() => handleDelete(tier.id)} className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1 rounded transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {tiers.length === 0 && !isCreating && (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-500">
                    <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-2 text-slate-400">
                      <Award size={22} />
                    </div>
                    <h3 className="text-xs font-bold text-slate-900">No tiers configured</h3>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {tiers.length > 0 && (
          <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-white">
            <div>
              Showing <span className="font-bold text-slate-900 font-mono">{(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, tiers.length)}</span> of <span className="font-bold text-slate-900 font-mono">{tiers.length}</span> tiers
            </div>
            <Pagination 
              currentPage={currentPage} 
              totalPages={Math.ceil(tiers.length / pageSize)} 
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
