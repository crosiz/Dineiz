'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/user-context';
import { Bell, Maximize, Minimize, Settings, Moon, Sun, ArrowLeft } from 'lucide-react';
import { BranchSelector } from '@/components/layout/header/BranchSelector';
import { SocketStatus } from './hooks/useKDS';
import { toast } from 'sonner';

interface KDSTopBarProps {
  branchName: string;
  socketStatus: SocketStatus;
  isFullscreen: boolean;
  onFullscreenToggle: () => void;
  onOpenSettings: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const iv = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);
  return (
    <div className="flex flex-col items-center">
      <span
        style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, letterSpacing: '-0.05em', fontSize: '20px' }}
      >
        {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </span>
      <span className="text-[10px] font-medium opacity-50 uppercase tracking-widest">
        {time.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
      </span>
    </div>
  );
}

export function KDSTopBar({ branchName, socketStatus, isFullscreen, onFullscreenToggle, onOpenSettings, isDark, onToggleTheme }: KDSTopBarProps) {
  const router = useRouter();
  const { branch } = useUser();
  const displayBranch = branch?.name ?? branchName;

  return (
    <div
      className="fixed top-0 left-0 right-0 h-[60px] px-6 z-50 flex items-center justify-between"
      style={{
        background: isDark ? '#111120' : '#ffffff',
        borderBottom: isDark ? '1px solid #1e293b' : '1px solid #e2e8f0',
      }}
    >
      <div className="grid grid-cols-3 w-full items-center">
        {/* Left — brand + branch */}
        <div className="flex items-center gap-4 justify-start">
          <button
            onClick={() => router.push('/dashboard')}
            className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'}`}
            title="Back to Dashboard"
          >
            <ArrowLeft size={16} />
          </button>
          <span className={`text-xl font-black uppercase tracking-widest ${isDark ? 'text-white' : 'text-slate-900'}`}>Dineiz Go</span>
          <div className={`h-4 w-px ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`} />
          <BranchSelector />
          <span className={`font-medium text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            {displayBranch}
          </span>
        </div>

        {/* Center — clock */}
        <div className={`flex justify-center flex-col items-center leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>
          <LiveClock />
        </div>

        {/* Right — status + controls */}
        <div className="flex items-center gap-6 justify-end">
          {/* Live indicator */}
          <div className="flex items-center gap-2">
            <span
              className="flex h-2 w-2 rounded-full"
              style={{
                background: socketStatus === 'connected' ? '#ef4444' : '#f59e0b',
                animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
              }}
            />
            <span
              className="font-bold text-xs uppercase tracking-wider"
              style={{ color: socketStatus === 'connected' ? '#ef4444' : '#f59e0b' }}
            >
              {socketStatus === 'connected' ? 'LIVE' : 'RECONNECTING'}
            </span>
          </div>

          {/* Icon controls */}
          <div className="flex items-center gap-3">
            <button onClick={onToggleTheme} className={`transition-colors ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`} title="Toggle Theme">
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button
              onClick={() => toast.info('Notification center is coming soon')}
              className={`transition-colors ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
              title="Notifications"
            >
              <Bell size={20} />
            </button>
            <button onClick={onOpenSettings} className={`transition-colors ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`} title="Settings">
              <Settings size={20} />
            </button>
            <button
              onClick={onFullscreenToggle}
              className={`transition-colors ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
              title={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
            >
              {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
