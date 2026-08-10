'use client';
import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiGet, apiPut } from '@/lib/api-client';
import { QRCodeSVG } from 'qrcode.react';
import { Settings, Phone, CheckCircle, QrCode as QrCodeIcon, Monitor, Copy, ExternalLink, Printer } from 'lucide-react';
import { useDashboardContext } from '@/contexts/dashboard-context';
import { useBranchFilter } from '@/hooks/useBranchFilter';

export default function QrOrderingPage() {
  const { currentTenant, currentBranch } = useDashboardContext() as any; // Type workaround if currentTenant exists in JS
  const { branchId, queryParam } = useBranchFilter();

  const { data: settingsData, refetch } = useQuery({
    queryKey: ['qr-settings', branchId],
    queryFn: () => apiGet<{ settings: any }>(`/api/qr/settings${queryParam ? `?${queryParam}` : ''}`)
  });

  // Fetch tables
  const { data: floorPlanData } = useQuery({
    queryKey: ['floor-plan', branchId],
    queryFn: () => apiGet<{ tables: any[] }>(`/api/floor-plan/${branchId}`),
    enabled: !!branchId
  });
  
  const tables = floorPlanData?.tables || [];

  const [saving, setSaving] = useState(false);
  
  // Local state for edits
  const [form, setForm] = useState<any>({});

  // Sync when data loads
  React.useEffect(() => {
    if (settingsData?.settings) {
      setForm(settingsData.settings);
    }
  }, [settingsData]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiPut('/api/qr/settings', data),
    onSuccess: () => {
      refetch();
    }
  });

  const handleChange = (field: string, value: any) => {
    const newForm = { ...form, [field]: value };
    setForm(newForm);
    // Auto save
    setSaving(true);
    updateMutation.mutate(newForm, {
      onSettled: () => setSaving(false)
    });
  };

  const domainUrl = `https://menu.dineiz.com/${currentTenant?.domain || currentTenant?.id}`;

  const handlePrintAll = () => {
    window.print();
  };

  if (!settingsData) return <div className="p-8">Loading...</div>;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <QrCodeIcon className="text-brand-primary" /> QR Table Ordering
            </h1>
            <p className="text-slate-500 mt-1">Let customers order directly from their phones.</p>
          </div>
          
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200">
            <span className="text-sm font-bold text-slate-700">Enable QR Ordering</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={form.isEnabled || false} 
                onChange={(e) => handleChange('isEnabled', e.target.checked)} 
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
            </label>
            {saving && <span className="text-xs text-slate-400">Saving...</span>}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Config Column */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Setup Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden print:hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                <Monitor className="text-slate-400" size={18} />
                <h2 className="font-bold text-slate-900">Setup & Table Codes</h2>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Menu URL</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      readOnly 
                      value={domainUrl} 
                      className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 font-mono outline-none"
                    />
                    <button onClick={() => navigator.clipboard.writeText(domainUrl)} className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold hover:bg-slate-50 flex items-center gap-2">
                      <Copy size={16} /> Copy
                    </button>
                    <a href={domainUrl} target="_blank" rel="noreferrer" className="px-4 py-2 bg-brand-primary text-white rounded-lg text-sm font-bold hover:bg-brand-primary/90 flex items-center gap-2">
                      <ExternalLink size={16} /> Preview
                    </a>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">To use a custom domain (e.g. menu.yourrestaurant.pk), point a CNAME record to cname.dineiz.com.</p>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-900 text-sm">Table QR Codes</h3>
                    <button onClick={handlePrintAll} className="text-brand-primary text-sm font-bold flex items-center gap-1.5 hover:underline">
                      <Printer size={16} /> Print All QR Codes
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-h-[300px] overflow-y-auto p-1">
                    {tables.map((table: any) => (
                      <div key={table.id} className="flex flex-col items-center justify-center p-4 border border-[#E2E8F0] rounded-xl bg-white hover:border-[#CBD5E1] transition-all">
                        <QRCodeSVG 
                          value={`${domainUrl}?table=${table.id}`} 
                          size={100} 
                          fgColor={form.qrColor || '#000000'}
                          className="bg-white p-2 rounded-lg shadow-sm"
                        />
                        <div className="mt-3 font-bold text-slate-900 text-sm">{table.name}</div>
                        <div className="text-[10px] text-slate-500">Seats: {table.seats}</div>
                      </div>
                    ))}
                    {(!tables || tables.length === 0) && (
                      <div className="col-span-full py-12 text-center text-[#64748B]">
                        No tables configured for this branch. Please add tables in the Floor Plan section.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Menu Settings */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden print:hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                <Settings className="text-slate-400" size={18} />
                <h2 className="font-bold text-slate-900">Menu & Payment Settings</h2>
              </div>
              <div className="p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900 text-sm">Allow Item Modifications</div>
                    <div className="text-xs text-slate-500">Customers can add notes/modifications to their items.</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={form.allowModifications || false} onChange={(e) => handleChange('allowModifications', e.target.checked)} />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-primary"></div>
                  </label>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900 text-sm">Show Item Images</div>
                    <div className="text-xs text-slate-500">Display item photos on the digital menu.</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={form.showImages || false} onChange={(e) => handleChange('showImages', e.target.checked)} />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-primary"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900 text-sm">Auto-Confirm Orders</div>
                    <div className="text-xs text-slate-500">Orders go straight to kitchen KDS. If off, staff must confirm pending QR orders.</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={form.autoConfirm || false} onChange={(e) => handleChange('autoConfirm', e.target.checked)} />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-primary"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-5">
                  <div>
                    <div className="font-bold text-slate-900 text-sm">Online Payments (JazzCash/EasyPaisa)</div>
                    <div className="text-xs text-slate-500">Allow customers to pay bill from their phone.</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={form.allowOnlinePayment || false} onChange={(e) => handleChange('allowOnlinePayment', e.target.checked)} />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                  </label>
                </div>

              </div>
            </div>
            
          </div>

          {/* Sidebar / Live Preview */}
          <div className="space-y-6 print:hidden">
            <div className="bg-slate-900 rounded-3xl p-4 shadow-2xl relative border-4 border-slate-800 h-[600px] flex flex-col overflow-hidden">
              {/* Phone Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-800 rounded-b-xl z-10"></div>
              
              {/* App UI Preview */}
              <div className="bg-white flex-1 rounded-xl overflow-hidden flex flex-col">
                {form.heroImage ? (
                  <div className="h-32 bg-slate-200 w-full" style={{ backgroundImage: `url(${form.heroImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
                ) : (
                  <div className="h-32 bg-gradient-to-br from-brand-primary to-brand-primary/80 w-full flex items-center justify-center">
                     <span className="text-white/50 text-sm">Hero Image</span>
                  </div>
                )}
                
                <div className="p-4 -mt-8 relative z-10">
                  <div className="bg-white rounded-xl shadow-md p-4 text-center">
                    <h2 className="font-black text-lg text-slate-900">{currentTenant?.name || 'Your Restaurant'}</h2>
                    <p className="text-xs text-slate-500 mt-1">{form.welcomeMessage || 'Welcome to our digital menu.'}</p>
                  </div>
                </div>

                <div className="flex-1 p-4 space-y-4 bg-slate-50">
                   <div className="h-4 w-24 bg-slate-200 rounded"></div>
                   <div className="flex gap-3 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                     {form.showImages && <div className="w-16 h-16 bg-slate-200 rounded-lg"></div>}
                     <div className="flex-1">
                        <div className="h-3 w-3/4 bg-slate-200 rounded mb-2"></div>
                        <div className="h-2 w-1/2 bg-slate-100 rounded mb-4"></div>
                        <div className="h-3 w-12 bg-slate-200 rounded"></div>
                     </div>
                   </div>
                   <div className="flex gap-3 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                     {form.showImages && <div className="w-16 h-16 bg-slate-200 rounded-lg"></div>}
                     <div className="flex-1">
                        <div className="h-3 w-2/3 bg-slate-200 rounded mb-2"></div>
                        <div className="h-2 w-1/2 bg-slate-100 rounded mb-4"></div>
                        <div className="h-3 w-12 bg-slate-200 rounded"></div>
                     </div>
                   </div>
                </div>
                
                {/* Checkout Bar Preview */}
                <div className="bg-white border-t border-slate-100 p-4">
                  <div className="bg-brand-primary text-white rounded-xl py-3 px-4 font-bold flex justify-between text-sm">
                    <span>View Cart (2)</span>
                    <span>Rs. 1,450</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold text-sm text-slate-900">Appearance Settings</h3>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Welcome Message</label>
                <input 
                  type="text" 
                  value={form.welcomeMessage || ''}
                  onChange={e => handleChange('welcomeMessage', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm outline-none focus:border-brand-primary"
                  placeholder="Welcome to our digital menu."
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">QR Code Color</label>
                <input 
                  type="color" 
                  value={form.qrColor || '#000000'}
                  onChange={e => handleChange('qrColor', e.target.value)}
                  className="w-full h-10 px-1 py-1 bg-white border border-slate-200 rounded-md cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Print Styles */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          .grid.grid-cols-2 {
            visibility: visible;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            grid-template-columns: repeat(4, 1fr) !important;
            gap: 20px !important;
          }
          .grid.grid-cols-2 * {
            visibility: visible;
          }
        }
      `}} />
    </div>
  );
}
