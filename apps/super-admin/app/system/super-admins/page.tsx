'use client';

import React, { useEffect, useState } from 'react';
import { Shield, UserPlus, Check, X, Lock } from 'lucide-react';

export default function SuperAdminsPage() {
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'OWNER' | 'SUPPORT' | 'SALES'>('SUPPORT');

  const fetchAdmins = () => {
    setLoading(true);
    fetch('/api/system/super-admins')
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json().catch(() => null);
      })
      .then((d) => {
        if (d?.superAdmins) setAdmins(d.superAdmins);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/system/super-admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to create super admin');
      } else {
        setShowAddModal(false);
        setName('');
        setEmail('');
        setPassword('');
        fetchAdmins();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleActive = async (adminId: string, currentActive: boolean) => {
    try {
      const res = await fetch('/api/system/super-admins', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ superAdminId: adminId, isActive: !currentActive }),
      });
      if (res.ok) fetchAdmins();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Super Admin Operations Team</h1>
          <p className="text-sm text-slate-400">Manage Dineiz internal team accounts and access permissions</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          <span>Create Super Admin</span>
        </button>
      </div>

      <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase font-semibold">
              <th className="py-3.5 px-4">Name</th>
              <th className="py-3.5 px-4">Email</th>
              <th className="py-3.5 px-4">Role</th>
              <th className="py-3.5 px-4">Last Login</th>
              <th className="py-3.5 px-4 text-right">Account Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {admins.map((a) => (
              <tr key={a.id} className="hover:bg-slate-900/50">
                <td className="py-3.5 px-4 font-bold text-white">{a.name}</td>
                <td className="py-3.5 px-4 text-slate-300">{a.email}</td>
                <td className="py-3.5 px-4">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    {a.role}
                  </span>
                </td>
                <td className="py-3.5 px-4 text-slate-400">
                  {a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString() : 'Never'}
                </td>
                <td className="py-3.5 px-4 text-right">
                  <button
                    onClick={() => handleToggleActive(a.id, a.isActive)}
                    className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all ${
                      a.isActive
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {a.isActive ? 'ACTIVE' : 'DEACTIVATED'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleAddAdmin} className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Create New Super Admin</h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ali Khan"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Email</label>
                <input
                  type="email"
                  required
                  placeholder="ali@dineiz.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white"
                >
                  <option value="SUPPORT">SUPPORT (Read-only billing, customer service)</option>
                  <option value="SALES">SALES (Client onboarding & trials)</option>
                  <option value="OWNER">OWNER (Full system control)</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-xs font-semibold text-slate-400">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-amber-500 text-slate-950 font-bold text-xs rounded-xl">
                Create Super Admin Account
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
