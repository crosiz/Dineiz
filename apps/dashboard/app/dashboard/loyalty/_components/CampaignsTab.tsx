'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@dineiz/ui/src/components/button';
import { Input } from '@dineiz/ui/src/components/input';
import { Pagination } from '@/components/ui/Pagination';
import { SkeletonList } from '@/components/ui/skeleton';
import { Trash2, Megaphone, Plus, AlertTriangle } from 'lucide-react';

function parseCondition(condition: string | null | undefined): { minSpend?: number } | null {
  if (!condition) return null;
  try {
    return JSON.parse(condition);
  } catch {
    return null;
  }
}

export function CampaignsTab() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({ name: '', type: 'MULTIPLIER', value: 2, isActive: true, minSpend: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchCampaigns = async () => {
    setLoading(true);
    setIsError(false);
    try {
      const res = await apiFetch<any[]>('/api/loyalty/campaigns');
      setCampaigns(res);
    } catch (e) {
      console.error(e);
      setIsError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleSave = async () => {
    try {
      const minSpend = formData.minSpend ? Number(formData.minSpend) : undefined;
      await apiFetch('/api/loyalty/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          name: formData.name,
          type: formData.type,
          value: formData.value,
          isActive: formData.isActive,
          condition: minSpend && minSpend > 0 ? JSON.stringify({ minSpend }) : null,
        }),
      });
      setIsCreating(false);
      setFormData({ name: '', type: 'MULTIPLIER', value: 2, isActive: true, minSpend: '' });
      toast.success('Campaign created');
      fetchCampaigns();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create campaign');
    }
  };

  const confirmDeleteCampaign = async () => {
    if (!deleteConfirmId) return;
    setIsDeleting(true);
    try {
      await apiFetch(`/api/loyalty/campaigns/${deleteConfirmId}`, { method: 'DELETE' });
      toast.success('Campaign deleted');
      setDeleteConfirmId(null);
      fetchCampaigns();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete campaign');
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) return <SkeletonList rows={3} />;

  if (isError) {
    return (
      <div className="p-10 text-center flex flex-col items-center">
        <p className="text-xs font-bold text-red-500 mb-2">Couldn't load campaigns.</p>
        <button onClick={fetchCampaigns} className="text-xs font-semibold text-brand-primary hover:underline">
          Try again
        </button>
      </div>
    );
  }

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
            className="h-9 px-3.5 bg-brand-primary hover:bg-brand-primary/90 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
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
                className="w-full h-8 px-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 outline-none focus:ring-1 focus:ring-brand-primary"
              >
                <option value="MULTIPLIER">Points Multiplier (e.g. 2x)</option>
                <option value="BONUS">Flat Bonus Points (e.g. 50 pts)</option>
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
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Minimum Order Spend (PKR, optional)</label>
              <Input
                type="number"
                min="0"
                step="1"
                value={formData.minSpend}
                onChange={e => setFormData({ ...formData, minSpend: e.target.value })}
                placeholder="No minimum"
                className="bg-white text-xs h-8"
              />
              <p className="text-[10px] text-slate-400 mt-1">Order must reach this net amount for the campaign to apply</p>
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
              disabled={!formData.name.trim()}
              className="h-8 px-4 text-xs font-semibold rounded-lg bg-brand-primary hover:bg-brand-primary/90 text-white shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
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
              {campaigns.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((camp) => {
                const condition = parseCondition(camp.condition);
                return (
                <tr key={camp.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-5 font-semibold text-slate-900">{camp.name}</td>
                  <td className="py-3 px-5 text-slate-600">{camp.type.replace('_', ' ')}</td>
                  <td className="py-3 px-5">
                    <div className="font-mono font-bold text-brand-primary">
                      {camp.type === 'MULTIPLIER' ? `${camp.value}x` : `+${camp.value} pts`}
                    </div>
                    {condition?.minSpend ? (
                      <div className="text-[10px] text-slate-400 mt-0.5">Min. order PKR {Number(condition.minSpend).toLocaleString()}</div>
                    ) : null}
                  </td>
                  <td className="py-3 px-5">
                    <span className={`px-2 py-0.5 text-[10px] uppercase font-semibold rounded ${camp.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {camp.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3 px-5 text-right">
                    <button onClick={() => setDeleteConfirmId(camp.id)} className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1 rounded transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );})}
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

      {deleteConfirmId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !isDeleting && setDeleteConfirmId(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-red-500" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Delete this campaign?</h3>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              It will stop applying to new orders immediately. This can't be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirmId(null)} disabled={isDeleting} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-50">
                Keep Campaign
              </button>
              <button
                onClick={confirmDeleteCampaign}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
