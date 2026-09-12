import { useState } from 'react'
import MenuManagement from '../MenuManagement/MenuManagement'
import Tables from '../Tables/Tables'
import Printers from '../Printers/Printers'
import Reports from '../Reports/Reports'
import Backups from '../Backups/Backups'
import Staff from '../Staff/Staff'
import Settings from '../Settings/Settings'

type AdminSection = 'menu' | 'tables' | 'printers' | 'reports' | 'backups' | 'staff' | 'settings'

const SECTIONS: { id: AdminSection; label: string; icon: string }[] = [
  { id: 'menu', label: 'Menu', icon: 'restaurant_menu' },
  { id: 'tables', label: 'Tables', icon: 'table_restaurant' },
  { id: 'printers', label: 'Printers', icon: 'print' },
  { id: 'reports', label: 'Reports', icon: 'bar_chart' },
  { id: 'backups', label: 'Backups', icon: 'cloud_upload' },
  { id: 'staff', label: 'Staff', icon: 'group' },
  { id: 'settings', label: 'Settings', icon: 'settings' }
]

export default function AdminShell() {
  const [section, setSection] = useState<AdminSection>('menu')

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-[var(--pos-border)] bg-[var(--pos-bg-card)] px-4">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSection(s.id)}
            className={`flex h-11 shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm font-semibold ${
              section === s.id
                ? 'border-[var(--pos-primary)] text-[var(--pos-primary)]'
                : 'border-transparent text-[var(--pos-text-secondary)]'
            }`}
          >
            <span className="material-symbols-outlined text-lg">{s.icon}</span>
            {s.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        {section === 'menu' && <MenuManagement />}
        {section === 'tables' && <Tables />}
        {section === 'printers' && <Printers />}
        {section === 'reports' && <Reports />}
        {section === 'backups' && <Backups />}
        {section === 'staff' && <Staff />}
        {section === 'settings' && <Settings />}
      </div>
    </div>
  )
}
