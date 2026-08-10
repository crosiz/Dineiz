'use client';
import { X } from 'lucide-react';
import { KDSSettings } from './hooks/useKDSSettings';

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${checked ? 'bg-green-500' : 'bg-slate-600'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : 'translate-x-1'}`} />
    </button>
  );
}

interface KDSSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings: KDSSettings;
  updateSettings: (updates: Partial<KDSSettings>) => void;
  isDark: boolean;
}

export function KDSSettingsPanel({ isOpen, onClose, settings, updateSettings, isDark }: KDSSettingsPanelProps) {
  if (!isOpen) return null;

  return (
    <div className={`fixed inset-y-0 right-0 z-[100] w-[320px] shadow-2xl flex flex-col ${isDark ? 'border-slate-800' : 'border-slate-200'}`} style={{ background: isDark ? '#111120' : '#ffffff', borderLeftWidth: '1px' }}>
      <div className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
        <h3 className={`font-semibold text-lg ${isDark ? 'text-white' : 'text-slate-900'}`}>KDS Settings</h3>
        <button onClick={onClose} className={`transition-colors ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'}`}>
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div>
          <label className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Rush threshold</label>
          <p className={`text-xs mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Orders older than this show RUSH badge</p>
          <div className="flex items-center gap-3">
            <input 
              type="number" 
              value={settings.rushThreshold} 
              onChange={e => updateSettings({ rushThreshold: parseInt(e.target.value) || 15 })}
              className={`w-20 border rounded px-3 py-2 ${isDark ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'}`} 
            />
            <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>minutes</span>
          </div>
        </div>

        <div>
          <label className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Auto-refresh interval</label>
          <select 
            value={settings.autoRefreshInterval}
            onChange={e => updateSettings({ autoRefreshInterval: parseInt(e.target.value) || 10 })}
            className={`w-full border rounded px-3 py-2 mt-1 ${isDark ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
          >
            <option value={10}>Every 10 seconds</option>
            <option value={30}>Every 30 seconds</option>
            <option value={60}>Every minute</option>
          </select>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <label className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Sound alerts</label>
            <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Chime when new order arrives</p>
          </div>
          <ToggleSwitch checked={settings.soundEnabled} onChange={v => updateSettings({ soundEnabled: v })} />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <label className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Show completed orders</label>
            <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Show last 10 completed in a column</p>
          </div>
          <ToggleSwitch checked={settings.showCompleted} onChange={v => updateSettings({ showCompleted: v })} />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <label className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Card font size</label>
          </div>
          <select 
            value={settings.cardFontSize}
            onChange={e => updateSettings({ cardFontSize: e.target.value as 'sm' | 'md' | 'lg' })}
            className={`border rounded px-2 py-1 text-sm ${isDark ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
          >
            <option value="sm">Small</option>
            <option value="md">Medium</option>
            <option value="lg">Large</option>
          </select>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <label className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Fullscreen on load</label>
          </div>
          <ToggleSwitch checked={settings.autoFullscreen} onChange={v => updateSettings({ autoFullscreen: v })} />
        </div>
      </div>
    </div>
  );
}
