'use client';
import React, { useState, useEffect } from 'react';
import { X, Save, Bell, AlertTriangle } from 'lucide-react';
import { apiGet, apiPut } from '@/lib/api-client';
import { Skeleton, SkeletonForm } from '@/components/ui/skeleton';

export function AnomalySettingsPanel({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [toggles, setToggles] = useState<any>({
    CASH_VARIANCE: true,
    EXCESSIVE_VOIDS: true,
    LARGE_DISCOUNT: true
  });
  
  const [thresholds, setThresholds] = useState<any>({
    cashVarianceThreshold: 500,
    excessiveVoidsCount: 5,
    largeDiscountPct: 25
  });

  const [notifications, setNotifications] = useState({
    notifyPush: true,
    notifyEmail: false,
    notifyWhatsapp: false
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await apiGet('/api/anomalies/settings') as any;
      if (res) {
        if (res.toggles) setToggles(res.toggles);
        if (res.thresholds) setThresholds(res.thresholds);
        setNotifications({
          notifyPush: res.notifyPush ?? true,
          notifyEmail: res.notifyEmail ?? false,
          notifyWhatsapp: res.notifyWhatsapp ?? false
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiPut('/api/anomalies/settings', {
        toggles,
        thresholds: {
          cashVarianceThreshold: Number(thresholds.cashVarianceThreshold),
          excessiveVoidsCount: Number(thresholds.excessiveVoidsCount),
          largeDiscountPct: Number(thresholds.largeDiscountPct)
        },
        ...notifications
      });
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/20 backdrop-blur-sm animate-in fade-in">
        <div
          className="w-[500px] bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right"
          role="status"
          aria-busy="true"
        >
          <span className="sr-only">Loading settings</span>
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-5 w-56" />
              <Skeleton className="h-3.5 w-40" />
            </div>
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
          <div className="flex-1 p-6">
            <SkeletonForm rows={6} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/20 backdrop-blur-sm animate-in fade-in">
      <div className="w-[500px] bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right">
        
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-800">Anomaly Detection Settings</h2>
            <p className="text-sm text-slate-500">Configure what triggers an alert.</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Rules Configuration */}
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle size={16} /> Detection Rules
            </h3>

            {/* Cash Variance */}
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-800">Cash Variance</h4>
                  <p className="text-sm text-slate-500 mt-1">Alert when a shift closes with mismatched cash.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={toggles.CASH_VARIANCE} onChange={(e) => setToggles({...toggles, CASH_VARIANCE: e.target.checked})} />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-primary"></div>
                </label>
              </div>
              {toggles.CASH_VARIANCE && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Max Variance Threshold (PKR)</label>
                  <input 
                    type="number"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
                    value={thresholds.cashVarianceThreshold}
                    onChange={(e) => setThresholds({...thresholds, cashVarianceThreshold: e.target.value})}
                  />
                </div>
              )}
            </div>

            {/* Excessive Voids */}
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-800">Excessive Voids</h4>
                  <p className="text-sm text-slate-500 mt-1">Alert when a shift has too many voided items.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={toggles.EXCESSIVE_VOIDS} onChange={(e) => setToggles({...toggles, EXCESSIVE_VOIDS: e.target.checked})} />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-primary"></div>
                </label>
              </div>
              {toggles.EXCESSIVE_VOIDS && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Max Voids per Shift</label>
                  <input 
                    type="number"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
                    value={thresholds.excessiveVoidsCount}
                    onChange={(e) => setThresholds({...thresholds, excessiveVoidsCount: e.target.value})}
                  />
                </div>
              )}
            </div>

            {/* Large Discount */}
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-800">Unusually Large Discounts</h4>
                  <p className="text-sm text-slate-500 mt-1">Alert when an order receives a massive discount.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={toggles.LARGE_DISCOUNT} onChange={(e) => setToggles({...toggles, LARGE_DISCOUNT: e.target.checked})} />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-primary"></div>
                </label>
              </div>
              {toggles.LARGE_DISCOUNT && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Alert Threshold (%)</label>
                  <input 
                    type="number"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
                    value={thresholds.largeDiscountPct}
                    onChange={(e) => setThresholds({...thresholds, largeDiscountPct: e.target.value})}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Notifications Configuration */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Bell size={16} /> Notification Channels
            </h3>
            
            <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
              <input 
                type="checkbox" 
                className="w-4 h-4 text-brand-primary rounded focus:ring-brand-primary" 
                checked={notifications.notifyPush}
                onChange={(e) => setNotifications({...notifications, notifyPush: e.target.checked})}
              />
              <div>
                <p className="font-bold text-slate-800">Push Notifications</p>
                <p className="text-xs text-slate-500">Receive alerts in this dashboard and mobile app.</p>
              </div>
            </label>
            
            <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
              <input 
                type="checkbox" 
                className="w-4 h-4 text-brand-primary rounded focus:ring-brand-primary" 
                checked={notifications.notifyWhatsapp}
                onChange={(e) => setNotifications({...notifications, notifyWhatsapp: e.target.checked})}
              />
              <div>
                <p className="font-bold text-slate-800">WhatsApp Alerts</p>
                <p className="text-xs text-slate-500">Receive instant WhatsApp messages for High/Critical anomalies.</p>
              </div>
            </label>
            
            <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
              <input 
                type="checkbox" 
                className="w-4 h-4 text-brand-primary rounded focus:ring-brand-primary" 
                checked={notifications.notifyEmail}
                onChange={(e) => setNotifications({...notifications, notifyEmail: e.target.checked})}
              />
              <div>
                <p className="font-bold text-slate-800">Email Alerts</p>
                <p className="text-xs text-slate-500">Receive daily summary emails of detected anomalies.</p>
              </div>
            </label>
          </div>

        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button 
            disabled={saving}
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl font-bold text-white bg-slate-800 hover:bg-slate-900 transition-colors flex items-center gap-2"
          >
            {saving ? 'Saving...' : <><Save size={18} /> Save Settings</>}
          </button>
        </div>
      </div>
    </div>
  );
}
