'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Button } from '@dineiz/ui/src/components/button';
import { Input } from '@dineiz/ui/src/components/input';
import { Pagination } from '@/components/ui/Pagination';

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

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-900">Special Campaigns</h2>
        <Button onClick={() => setIsCreating(true)}>Add Campaign</Button>
      </div>

      {isCreating && (
        <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 space-y-4">
          <h3 className="font-bold text-gray-900">Create New Campaign</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Campaign Name</label>
              <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select className="w-full border border-gray-200 rounded-lg p-2.5 text-sm" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                <option value="MULTIPLIER">Points Multiplier</option>
                <option value="BONUS">Flat Bonus Points</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Value ({formData.type === 'MULTIPLIER' ? 'e.g. 2 for 2x' : 'points'})</label>
              <Input type="number" step="any" value={formData.value} onChange={e => setFormData({ ...formData, value: Number(e.target.value) })} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save Campaign</Button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-slate-100 text-[11px] uppercase text-slate-500 font-bold tracking-wider">
              <tr>
                <th className="py-4 px-6">Name</th>
                <th className="py-4 px-6">Type</th>
                <th className="py-4 px-6">Value</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {campaigns.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((camp) => (
                <tr key={camp.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                  <td className="py-4 px-6 font-bold text-slate-900">{camp.name}</td>
                  <td className="py-4 px-6 text-[13px] text-slate-600 font-medium">{camp.type.replace('_', ' ')}</td>
                  <td className="py-4 px-6 text-[13px] font-bold text-[#FF5722]">
                    {camp.type === 'MULTIPLIER' ? `${camp.value}x` : `+${camp.value} pts`}
                  </td>
                  <td className="py-4 px-6">
                    <span className={`px-2 py-1 text-[10px] uppercase tracking-wide font-bold rounded ${camp.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                      {camp.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button onClick={() => handleDelete(camp.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-colors">
                      <span className="material-symbols-outlined text-[20px]">delete</span>
                    </button>
                  </td>
                </tr>
              ))}
              {campaigns.length === 0 && !isCreating && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <span className="material-symbols-outlined text-slate-300 text-3xl">campaign</span>
                    </div>
                    <h3 className="text-[13px] font-bold text-slate-900">No campaigns found</h3>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {campaigns.length > 0 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-[13px] text-slate-500 bg-white">
            <div>
              Showing <span className="font-bold text-slate-900">{(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, campaigns.length)}</span> of <span className="font-bold text-slate-900">{campaigns.length}</span> campaigns
            </div>
            <Pagination 
              currentPage={currentPage} 
              totalPages={Math.max(1, Math.ceil(campaigns.length / pageSize))} 
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
