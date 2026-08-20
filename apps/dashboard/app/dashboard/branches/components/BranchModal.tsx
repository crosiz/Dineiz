'use client';

import React, { useState, useEffect } from 'react';
import { X, Loader2, ChevronLeft, ChevronRight, ArrowUpCircle } from 'lucide-react';
import { Button } from '@dineiz/ui';
import { Input } from '@dineiz/ui';
import { toast } from 'sonner';
import { useBranches } from '@/components/features/branches/hooks/useBranches';

type BranchModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  branchToEdit: any | null;
};

// Upgrade modal shown when PLAN_LIMIT is hit
function UpgradeModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
        <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <ArrowUpCircle className="w-8 h-8 text-amber-500" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Branch Limit Reached</h2>
        <p className="text-neutral-500 mb-6">
          Your current <strong>Starter</strong> plan allows <strong>1 branch</strong>. Upgrade to <strong>Professional</strong> to add unlimited branches.
        </p>
        <div className="grid grid-cols-2 gap-4 mb-6 text-left">
          <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-4">
            <p className="text-xs text-neutral-400 mb-1">Current Plan</p>
            <p className="font-bold">Starter</p>
            <p className="text-sm text-neutral-500">1 branch</p>
          </div>
          <div className="border-2 border-brand-primary rounded-xl p-4 bg-brand-primary/5">
            <p className="text-xs text-brand-primary mb-1">Upgrade To</p>
            <p className="font-bold">Professional</p>
            <p className="text-sm text-neutral-500">Unlimited branches</p>
          </div>
        </div>
        <Button className="w-full mb-3">Upgrade Plan</Button>
        <button onClick={onClose} className="text-sm text-neutral-500 hover:text-neutral-700">Maybe later</button>
      </div>
    </div>
  );
}

export default function BranchModal({ isOpen, onClose, onSuccess, branchToEdit }: BranchModalProps) {
  const { addBranchMutation, updateBranchMutation } = useBranches();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  // Step 1 — Basic Info
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // Step 2 — Operating Hours (single daily window — the backend only
  // stores one openingTime/closingTime pair per branch, not per-day hours)
  const [openingTime, setOpeningTime] = useState('09:00');
  const [closingTime, setClosingTime] = useState('22:00');

  // Step 3 — Settings
  const [currency, setCurrency] = useState('PKR');
  const [timezone, setTimezone] = useState('Asia/Karachi');
  const [taxRate, setTaxRate] = useState('0');
  const [kdsEnabled, setKdsEnabled] = useState(false);
  const [kotAutoPrint, setKotAutoPrint] = useState(false);

  useEffect(() => {
    if (branchToEdit) {
      setName(branchToEdit.name || '');
      setAddress(branchToEdit.address || '');
      setCity(branchToEdit.city || '');
      setPhone(branchToEdit.phone || '');
      setEmail(branchToEdit.email || '');
      setOpeningTime(branchToEdit.openingTime || '09:00');
      setClosingTime(branchToEdit.closingTime || '22:00');
      setCurrency(branchToEdit.currency || 'PKR');
      setTimezone(branchToEdit.timezone || 'Asia/Karachi');
      setTaxRate(String(branchToEdit.taxRate ?? 0));
      setKdsEnabled(!!branchToEdit.kdsEnabled);
      setKotAutoPrint(!!branchToEdit.kotAutoPrint);
    } else {
      setName(''); setAddress(''); setCity(''); setPhone(''); setEmail('');
      setOpeningTime('09:00'); setClosingTime('22:00');
      setCurrency('PKR'); setTimezone('Asia/Karachi'); setTaxRate('0');
      setKdsEnabled(false); setKotAutoPrint(false);
    }
    setStep(1);
  }, [isOpen, branchToEdit]);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const body = {
        name, address, city, phone, email,
        openingTime, closingTime,
        currency, timezone,
        taxRate: parseFloat(taxRate) || 0,
        kdsEnabled, kotAutoPrint,
      };

      if (branchToEdit) {
        await updateBranchMutation.mutateAsync({ id: branchToEdit.id, data: body });
      } else {
        await addBranchMutation.mutateAsync(body);
      }

      toast.success(branchToEdit ? 'Branch updated' : 'Branch created');
      onSuccess();
      onClose();
    } catch (e: any) {
      if (e?.message === 'PLAN_LIMIT_REACHED') {
        setShowUpgrade(true);
        return;
      }
      toast.error(e?.message || 'Failed to save branch');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}

      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">

          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
            <div>
              <h2 className="text-xl font-bold">{branchToEdit ? 'Edit Branch' : 'Add New Branch'}</h2>
              <div className="flex items-center mt-2 space-x-2">
                {[1, 2, 3].map(s => (
                  <div key={s} className="flex items-center">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step >= s ? 'bg-brand-primary text-white' : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-400'}`}>
                      {s}
                    </div>
                    {s < 3 && <div className={`w-8 h-0.5 mx-1 ${step > s ? 'bg-brand-primary' : 'bg-neutral-200 dark:bg-neutral-700'}`} />}
                  </div>
                ))}
                <span className="text-sm text-neutral-500 ml-2">
                  Step {step} of 3 — {step === 1 ? 'Basic Info' : step === 2 ? 'Operating Hours' : 'Settings'}
                </span>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6">

            {/* Step 1 */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Branch Name <span className="text-red-500">*</span></label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Clifton Branch" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Address <span className="text-red-500">*</span></label>
                  <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="e.g. Block 4, Clifton" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">City <span className="text-red-500">*</span></label>
                  <Input value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Karachi" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Phone Number</label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+92 300 1234567" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Email</label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="branch@restaurant.com" />
                </div>
              </div>
            )}

            {/* Step 2 */}
            {step === 2 && (
              <div className="space-y-4">
                <p className="text-sm text-neutral-500">These hours apply every day the branch is open.</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Opening Time</label>
                    <Input type="time" value={openingTime} onChange={e => setOpeningTime(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Closing Time</label>
                    <Input type="time" value={closingTime} onChange={e => setClosingTime(e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {/* Step 3 */}
            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Currency</label>
                  <select
                    value={currency}
                    onChange={e => setCurrency(e.target.value)}
                    className="w-full rounded-md border border-neutral-200 dark:border-neutral-800 bg-transparent px-3 py-2 text-sm"
                  >
                    <option value="PKR">PKR — Pakistani Rupee</option>
                    <option value="USD">USD — US Dollar</option>
                    <option value="AED">AED — UAE Dirham</option>
                    <option value="GBP">GBP — British Pound</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Timezone</label>
                  <select
                    value={timezone}
                    onChange={e => setTimezone(e.target.value)}
                    className="w-full rounded-md border border-neutral-200 dark:border-neutral-800 bg-transparent px-3 py-2 text-sm"
                  >
                    <option value="Asia/Karachi">Asia/Karachi (PKT +5:00)</option>
                    <option value="Asia/Dubai">Asia/Dubai (GST +4:00)</option>
                    <option value="Europe/London">Europe/London (GMT)</option>
                    <option value="America/New_York">America/New_York (EST)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Tax Rate (%)</label>
                  <Input type="number" min={0} max={100} step="0.1" value={taxRate} onChange={e => setTaxRate(e.target.value)} placeholder="0" />
                </div>
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between p-4 rounded-lg border border-neutral-200 dark:border-neutral-800">
                    <div>
                      <p className="text-sm font-medium">KDS (Kitchen Display System)</p>
                      <p className="text-xs text-neutral-500">Show orders on a kitchen screen</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setKdsEnabled(!kdsEnabled)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${kdsEnabled ? 'bg-brand-primary' : 'bg-neutral-300 dark:bg-neutral-700'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${kdsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg border border-neutral-200 dark:border-neutral-800">
                    <div>
                      <p className="text-sm font-medium">KOT Auto-Print</p>
                      <p className="text-xs text-neutral-500">Print kitchen order tickets automatically on order</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setKotAutoPrint(!kotAutoPrint)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${kotAutoPrint ? 'bg-brand-primary' : 'bg-neutral-300 dark:bg-neutral-700'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${kotAutoPrint ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-neutral-200 dark:border-neutral-800 flex justify-between items-center shrink-0">
            <Button variant="outline" onClick={step === 1 ? onClose : () => setStep(s => s - 1)} disabled={loading}>
              {step === 1 ? 'Cancel' : <><ChevronLeft className="w-4 h-4 mr-1" /> Back</>}
            </Button>

            {step < 3 ? (
              <Button onClick={() => {
                if (step === 1 && (!name.trim() || !address.trim() || !city.trim())) {
                  toast.error('Please fill in all required fields');
                  return;
                }
                setStep(s => s + 1);
              }}>
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : (branchToEdit ? 'Save Changes' : 'Create Branch')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
