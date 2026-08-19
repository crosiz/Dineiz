'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Button } from '@dineiz/ui/src/components/button';
import { Input } from '@dineiz/ui/src/components/input';
import { Pagination } from '@/components/ui/Pagination';
import { PageLoader } from '@/components/ui/Spinner';
import { Trash2, Megaphone, Plus } from 'lucide-react';

export function CampaignsTab() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({ name: '', type: 'MULTIPLIER', value: 2, isActive: true });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const fetchCampaigns = async () => {
    try {
      const res = await apiFetch<any[]>('/api/loyalty/campaigns');
      setCampaigns(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleSave = async () => {
    try {
      await apiFetch('/api/loyalty/campaigns', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      setIsCreating(false);
      setFormData({ name: '', type: 'MULTIPLIER', value: 2, isActive: true });
      fetchCampaigns();
    } catch (e: any) {
      alert(e?.message || 'Failed to create campaign');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this campaign?')) return;
    try {
      await apiFetch(`/api/loyalty/campaigns/${id}`, { method: 'DELETE' });
      fetchCampaigns();
    } catch (e: any) {
      alert(e?.message || 'Failed to delete campaign');
    }
  };

  if (loading) return <PageLoader label="Loading campaigns..." />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Promotional Campaigns</h2>
          <p className="text-xs text-slate-500 mt-0.5">Run limited-time bonus point multipliers or flat reward drops</p>
        </div>
        {!isCreating && (
          <button 
            onClick={() => setIsCreating(true)}
            className="h-9 px-3.5 bg-[#FF5722] hover:bg-[#F4511E] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Plus size={15} /> Create Campaign
          </button>
        )}
      </div>

      {isCreating && (
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
          <h3 className="text-xs font-bold text-slate-900">New Campaign Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Campaign Name</label>
              <Input 
                value={formData.name} 
                onChange={e => setFormData({ ...formData, name: e.target.value })} 
                placeholder="e.g. Double Points Weekend" 
                className="bg-white text-xs h-8"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Campaign Type</label>
              <select 
                value={formData.type} 
                onChange={e => setFormData({ ...formData, type: e.target.value })}
                className="w-full h-8 px-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 outline-none focus:ring-1 focus:ring-[#FF5722]"
              >
                <option value="MULTIPLIER">Points Multiplier (e.g. 2x)</option>
                <option value="FLAT_POINTS">Flat Bonus Points (e.g. 50 pts)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Value ({formData.type === 'MULTIPLIER' ? 'Multiplier Factor' : 'Bonus Points'})</label>
              <Input 
                type="number" 
                step={formData.type === 'MULTIPLIER' ? '0.1' : '1'}
                value={formData.value} 
                onChange={e => setFormData({ ...formData, value: Number(e.target.value) })} 
                className="bg-white text-xs h-8"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button 
              onClick={() => setIsCreating(false)}
              className="h-8 px-3 text-xs font-semibold rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-xs"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              className="h-8 px-4 text-xs font-semibold rounded-lg bg-[#FF5722] hover:bg-[#F4511E] text-white shadow-xs"
            >
              Save Campaign
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50 text-slate-500 font-semibold">
              <tr>
                <th className="py-3 px-5">Campaign</th>
                <th className="py-3 px-5">Type</th>
                <th className="py-3 px-5">Value</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {campaigns.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((camp) => (
                <tr key={camp.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-5 font-semibold text-slate-900">{camp.name}</td>
                  <td className="py-3 px-5 text-slate-600">{camp.type.replace('_', ' ')}</td>
                  <td className="py-3 px-5 font-mono font-bold text-[#FF5722]">
                    {camp.type === 'MULTIPLIER' ? `${camp.value}x` : `+${camp.value} pts`}
                  </td>
                  <td className="py-3 px-5">
                    <span className={`px-2 py-0.5 text-[10px] uppercase font-semibold rounded ${camp.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {camp.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3 px-5 text-right">
                    <button onClick={() => handleDelete(camp.id)} className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1 rounded transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {campaigns.length === 0 && !isCreating && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-2 text-slate-400">
                      <Megaphone size={22} />
                    </div>
                    <h3 className="text-xs font-bold text-slate-900">No campaigns found</h3>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {campaigns.length > 0 && (
          <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-white">
            <div>
              Showing <span className="font-bold text-slate-900 font-mono">{(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, campaigns.length)}</span> of <span className="font-bold text-slate-900 font-mono">{campaigns.length}</span> campaigns
            </div>
            <Pagination 
              currentPage={currentPage} 
              totalPages={Math.ceil(campaigns.length / pageSize)} 
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
