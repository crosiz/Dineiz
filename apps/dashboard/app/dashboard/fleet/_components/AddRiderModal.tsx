import React, { useState } from 'react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';

export function AddRiderModal({ branchId, onClose, onSuccess }: { branchId: string; onClose: () => void; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name'),
      phone: formData.get('phone'),
      passcode: formData.get('passcode') || '1234',
    };

    setLoading(true);
    try {
      await apiFetch(`/api/fleet/riders?branchId=${branchId}`, {
        method: 'POST',
        body: JSON.stringify(data),
      });

      toast.success('Rider added successfully');
      onSuccess();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Add New Rider</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input 
              name="name" 
              required 
              autoFocus
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900" 
              placeholder="E.g. Bilal Ahmed" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number (Login ID)</label>
            <input 
              name="phone" 
              required 
              type="tel"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900" 
              placeholder="03001234567" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Passcode</label>
            <input 
              name="passcode" 
              type="text"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900" 
              defaultValue="1234"
            />
            <p className="text-xs text-gray-500 mt-1">Default passcode for Rider App</p>
          </div>

          <div className="flex gap-3 pt-4">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="flex-1 px-4 py-2 text-white bg-[#ff5722] hover:bg-[#e64a19] rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Rider'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
