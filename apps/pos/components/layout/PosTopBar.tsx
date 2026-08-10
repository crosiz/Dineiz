import React from 'react';
import { DineizLogo } from '../ui/DineizLogo';

interface PosTopBarProps {
  title?: string
  showBack?: boolean
  onBack?: () => void
  center?: React.ReactNode  // custom center content
  right?: React.ReactNode   // custom right content
}

export function PosTopBar({ title, showBack, onBack, center, right }: PosTopBarProps) {
  return (
    <header
      className="h-[56px] shrink-0 flex items-center justify-between px-4"
      style={{
        backgroundColor: 'var(--pos-bg-raised)',
        borderBottom: '1px solid var(--pos-border)',
      }}
    >
      <div className="flex items-center gap-3 min-w-[200px]">
        {showBack && (
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ backgroundColor: 'var(--pos-bg-card)' }}
          >
            <svg width="16" height="16" fill="none" stroke="var(--pos-text-secondary)" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </button>
        )}
        <DineizLogo size="sm" variant="light" showBadge={true} />
        {title && (
          <div className="flex items-center gap-2 pl-2 border-l border-[#E2E8F0]">
            <span className="text-[#0F172A] font-semibold text-[15px]">{title}</span>
          </div>
        )}
      </div>

      {center && <div className="flex-1 flex justify-center">{center}</div>}

      <div className="flex items-center gap-3 min-w-[120px] justify-end">
        {right}
      </div>
    </header>
  )
}
