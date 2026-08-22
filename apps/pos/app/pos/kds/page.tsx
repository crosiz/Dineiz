'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/lib/store';
import { useSocket } from '@/contexts/SocketContext';
import { getPosSession, clearPosSession, getToken } from '@/lib/pos-session';
import { toast } from 'sonner';
import { Check, Settings, RefreshCw, LogOut, X } from 'lucide-react';
import { DineizLogo } from '@/components/ui/DineizLogo';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface OrderItem {
  id: string;
  stationId?: string | null;
  kdsStatus?: string;
  name: string;
  quantity: number;
  variation?: string | null;
  addons?: string[];
  createdAt?: string;
}

interface KdsOrder {
  id: string;
  orderNumber: string;
  type: string;
  createdAt: string;
  table?: { name: string } | null;
  takeawayToken?: string | null;
  status: string;
  items: OrderItem[];
}

interface KdsStationInfo {
  id: string;
  name: string;
  orderCount: number;
  color?: string;
}

interface KdsSummary {
  inQueue: number;
  inProgress: number;
  completedToday: number;
  avgPrepTimeSeconds: number;
}

interface KdsSettings {
  soundAlerts: boolean;
  rushThreshold: number;
  autoScroll: boolean;
  fontSize: 'small' | 'medium' | 'large';
}

function Clock() {
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    setTime(new Date());
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!time) return <div className="w-20"></div>;

  const formattedTime = time.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return <span className="font-mono text-[20px] font-bold text-white tracking-widest">{formattedTime}</span>;
}

export default function KDSPage() {
  const router = useRouter();
  const session = useCartStore((s) => s.session);
  const clearSession = useCartStore((s) => s.clearSession);
  const { socket, isConnected } = useSocket();

  const [isMounted, setIsMounted] = useState(false);
  const [orders, setOrders] = useState<KdsOrder[]>([]);
  const [stations, setStations] = useState<KdsStationInfo[]>([]);
  const [summary, setSummary] = useState<KdsSummary | null>(null);
  
  const [activeStationId, setActiveStationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<KdsSettings>({
    soundAlerts: true,
    rushThreshold: 15,
    autoScroll: true,
    fontSize: 'medium'
  });
  
  // Removed audioRef

  const fetchDashboard = useCallback(async () => {
    if (!session?.branchId) return;
    try {
      setIsLoading(true);
      const res = await fetch(`${API_URL}/api/kds/orders?branchId=${session.branchId}${activeStationId ? `&stationId=${activeStationId}` : ''}`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        // POS KDS only shows pending and cooking orders, not ready orders
        setOrders(data.orders.filter((o: any) => o.status !== 'READY' && o.status !== 'COMPLETED'));
        setStations(data.stations);
        setSummary(data.summary);
      } else {
        console.error('Failed to fetch KDS data', await res.text());
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [session?.branchId, activeStationId]);

  useEffect(() => {
    setIsMounted(true);
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    // Removed mp3 audio load in favor of Web Audio API
  }, [settings.soundAlerts]);

  useEffect(() => {
    // Load Settings
    if (session?.branchId) {
      const stored = localStorage.getItem(`kds_settings_${session.branchId}`);
      if (stored) {
        try {
          setSettings(JSON.parse(stored));
        } catch (e) {}
      }
    }
  }, [session?.branchId]);

  const saveSettings = (newSettings: KdsSettings) => {
    setSettings(newSettings);
    if (session?.branchId) {
      localStorage.setItem(`kds_settings_${session.branchId}`, JSON.stringify(newSettings));
    }
  };

  // Socket Events
  useEffect(() => {
    if (!socket || !session?.branchId) return;
    
    socket.emit('join_branch', session.branchId);

    const handleOrderCreated = () => {
      fetchDashboard();
      if (settings.soundAlerts) {
        playLoudRing();
      }
    };

    const handleOrderUpdated = () => {
      fetchDashboard();
    };

    socket.on('order:created', handleOrderCreated);
    socket.on('order:status_changed', handleOrderUpdated);
    socket.on('order:cancelled', handleOrderUpdated);
    socket.on('kds:item_ready', handleOrderUpdated);
    socket.on('kds:order_bumped', handleOrderUpdated);

    return () => {
      socket.off('order:created', handleOrderCreated);
      socket.off('order:status_changed', handleOrderUpdated);
      socket.off('order:cancelled', handleOrderUpdated);
      socket.off('kds:item_ready', handleOrderUpdated);
      socket.off('kds:order_bumped', handleOrderUpdated);
    };
  }, [socket, session?.branchId, fetchDashboard, settings.soundAlerts]);

  const handleLogout = () => {
    clearSession();
    clearPosSession();
    router.push('/login');
  };

  return (
    <div className={`flex flex-col h-screen select-none font-body-md text-[#0F172A] bg-[#F8FAFC] overflow-hidden font-size-${settings.fontSize}`}>
      <style dangerouslySetInnerHTML={{ __html: `
        .pulse-green { animation: pulseGreen 1.5s infinite; }
        @keyframes pulseGreen { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }
        .pulse-amber { animation: pulseAmber 2s infinite ease-in-out; }
        @keyframes pulseAmber { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; transform: scale(1.02); } }
        .pulse-red { animation: pulseRed 0.8s infinite alternate; }
        @keyframes pulseRed { from { opacity: 0.4; box-shadow: 0 0 0px #ef4444; } to { opacity: 1; box-shadow: 0 0 15px rgba(239, 68, 68, 0.5); } }
        .slide-out { animation: slideOut 0.5s forwards ease-in-out; }
        @keyframes slideOut { to { transform: translateX(100%); opacity: 0; } }
        .font-size-small { --kds-font-base: 12px; --kds-font-lg: 16px; --kds-font-xl: 18px; }
        .font-size-medium { --kds-font-base: 14px; --kds-font-lg: 18px; --kds-font-xl: 20px; }
        .font-size-large { --kds-font-base: 16px; --kds-font-lg: 20px; --kds-font-xl: 24px; }
      `}} />

      {/* Top Bar (72px) */}
      <header className="flex items-center justify-between whitespace-nowrap border-b border-[#E2E8F0] bg-white px-6 py-3 shrink-0 h-[72px] relative z-10 shadow-sm">
        
        {/* Left Slot: Logo & Titles */}
        <div className="flex items-center gap-3.5 text-[#0F172A] min-w-[280px]">
          <DineizLogo 
            size="md" 
            variant="light"
            showBadge={true} 
            badgeText="KDS"
          />

          <div className="flex items-center gap-3 pl-2 border-l border-[#E2E8F0]">
            <div>
              <h2 className="clash-display text-lg font-bold leading-tight tracking-[-0.015em] text-[#0F172A]">Kitchen Display</h2>
              <div className="text-[10px] text-[#64748B] uppercase tracking-widest leading-none font-semibold">
                {isMounted ? (session?.branchName || 'Branch') : 'Branch'}
              </div>
            </div>
          </div>
        </div>
        
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center">
          <Clock />
        </div>

        <div className="flex items-center justify-end gap-4 min-w-[300px]">
          <div className="flex items-center gap-2 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            <span className="w-2 h-2 bg-emerald-500 rounded-full pulse-green"></span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Live</span>
          </div>

          <div className="w-[1px] h-6 bg-[#CBD5E1] mx-2"></div>

          <button onClick={fetchDashboard} className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9] transition-colors border border-transparent hover:border-[#CBD5E1]">
            <RefreshCw size={20} className="text-[#475569]" />
          </button>
          <button onClick={() => setShowSettings(true)} className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9] transition-colors border border-transparent hover:border-[#CBD5E1]">
            <Settings size={20} className="text-[#475569]" />
          </button>
          <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors border border-transparent hover:border-red-200">
            <LogOut size={16} />
            <span className="text-[14px] font-medium">Log Out</span>
          </button>
        </div>
      </header>

      {/* Station Filter Tabs */}
      <div className="h-[48px] bg-white border-b border-[#E2E8F0] flex items-center px-2 overflow-x-auto no-scrollbar shrink-0">
        <button
          onClick={() => setActiveStationId(null)}
          className={`px-4 h-full flex items-center gap-2 border-b-2 transition-colors shrink-0 ${
            activeStationId === null
              ? 'border-[var(--pos-primary,#3B82F6)] text-[var(--pos-primary,#3B82F6)] font-semibold'
              : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
          }`}
        >
          All Orders
        </button>
        {stations.map(st => (
          <button
            key={st.id}
            onClick={() => setActiveStationId(st.id)}
            className={`px-4 h-full flex items-center gap-2 border-b-2 transition-colors shrink-0 ${
              activeStationId === st.id
                ? 'border-[var(--pos-primary,#3B82F6)] text-[var(--pos-primary,#3B82F6)] font-semibold'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            {st.name}
            {st.orderCount > 0 && (
              <span className="bg-[#E2E8F0] text-[#64748B] px-2 py-0.5 rounded-full text-[12px] font-medium">{st.orderCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Order Cards Grid */}
      <main className="flex-1 overflow-y-auto p-4 bg-[#F8FAFC]">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-[#64748B]">Loading...</div>
        ) : orders.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[#64748B]">No active orders</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 auto-rows-max">
            {orders.map(order => (
              <OrderCard 
                key={order.id} 
                order={order} 
                rushThreshold={settings.rushThreshold} 
                onReady={(id) => {
                  setOrders(prev => prev.filter(o => o.id !== id));
                }}
                onReadyFailed={(failedOrder) => {
                  setOrders(prev => (prev.some(o => o.id === failedOrder.id) ? prev : [...prev, failedOrder]));
                }}
              />
            ))}
          </div>
        )}
      </main>

      {/* Bottom Status Bar */}
      <footer className="h-[32px] bg-white border-t border-[#E2E8F0] flex items-center justify-between px-4 shrink-0 text-[12px] text-[#64748B]">
        <div className="flex gap-4">
          <span>Queue: {summary?.inQueue || 0}</span>
          <span>In Progress: {summary?.inProgress || 0}</span>
          <span>Completed Today: {summary?.completedToday || 0}</span>
          <span>Avg Time: {Math.floor((summary?.avgPrepTimeSeconds || 0) / 60)}m</span>
        </div>
        <div className="flex items-center gap-1.5">
          {isConnected ? (
            <>
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              <span className="text-green-500">Online</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              <span className="text-red-500">Offline</span>
            </>
          )}
        </div>
      </footer>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/40 backdrop-blur-sm">
          <div className="bg-white border border-[#E2E8F0] rounded-xl w-[400px] p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-[20px] font-semibold text-[#0F172A]">KDS Settings</h2>
              <button onClick={() => setShowSettings(false)} className="text-[#64748B] hover:text-[#0F172A]">
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-[#475569] font-medium">Sound Alerts</span>
                <button 
                  onClick={() => saveSettings({...settings, soundAlerts: !settings.soundAlerts})}
                  className={`w-12 h-6 rounded-full transition-colors relative ${settings.soundAlerts ? 'bg-green-500' : 'bg-[#CBD5E1]'}`}
                >
                  <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.soundAlerts ? 'translate-x-6' : ''}`} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#475569] font-medium">Auto-Scroll to New</span>
                <button 
                  onClick={() => saveSettings({...settings, autoScroll: !settings.autoScroll})}
                  className={`w-12 h-6 rounded-full transition-colors relative ${settings.autoScroll ? 'bg-green-500' : 'bg-[#CBD5E1]'}`}
                >
                  <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.autoScroll ? 'translate-x-6' : ''}`} />
                </button>
              </div>

              <div>
                <label className="text-[#475569] font-medium block mb-2">Rush Threshold (minutes)</label>
                <input 
                  type="number" 
                  value={settings.rushThreshold}
                  onChange={(e) => saveSettings({...settings, rushThreshold: parseInt(e.target.value) || 15})}
                  className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2 text-[#0F172A] outline-none focus:border-[var(--pos-primary,#3B82F6)]"
                  min={1}
                />
              </div>

              <div>
                <label className="text-[#475569] font-medium block mb-2">Font Size</label>
                <div className="flex gap-2">
                  {['small', 'medium', 'large'].map(sz => (
                     <button 
                       key={sz}
                       onClick={() => saveSettings({...settings, fontSize: sz as any})}
                       className={`flex-1 py-1.5 rounded-lg border capitalize transition-colors ${
                         settings.fontSize === sz 
                           ? 'border-[var(--pos-primary,#3B82F6)] bg-[var(--pos-primary,#3B82F6)]/10 text-[var(--pos-primary,#3B82F6)]' 
                           : 'border-[#CBD5E1] text-[#64748B] hover:border-[#94A3B8]'
                       }`}
                     >
                       {sz}
                     </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function playLoudRing() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const playPop = (freq: number, startTime: number, isHigh: boolean) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      // A triangle wave gives that digital "pop" or "app notification bell" sound
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);
      
      // Fast attack, punchy short decay (marimba/bell style)
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(isHigh ? 0.8 : 0.6, startTime + 0.01); 
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + (isHigh ? 0.4 : 0.2)); 
      
      osc.start(startTime);
      osc.stop(startTime + 0.5);
    };

    const now = ctx.currentTime;
    // Classic bouncy "Di-Ding!" food app sound
    for (let i = 0; i < 3; i++) {
      const offset = i * 1.2; // Repeat the double-chime 3 times with a pause
      playPop(987.77, now + offset, false);       // B5 (quick intro note)
      playPop(1318.51, now + offset + 0.15, true); // E6 (higher main note, rings slightly longer)
    }
  } catch (e) {
    console.error('Web Audio API not supported', e);
  }
}

function OrderCard({ order, rushThreshold, onReady, onReadyFailed }: { order: KdsOrder, rushThreshold: number, onReady: (id: string) => void, onReadyFailed: (order: KdsOrder) => void }) {
  const session = useCartStore((s) => s.session);
  const [toggledItems, setToggledItems] = useState<Record<string, boolean>>({});
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [isSlidingOut, setIsSlidingOut] = useState(false);
  const [isReprinting, setIsReprinting] = useState(false);

  const handleReprintKOT = async () => {
    setIsReprinting(true);
    try {
      const { printDocument } = await import('@/lib/print.service');
      await printDocument('KOT', {
        orderNumber: order.orderNumber,
        tokenNumber: order.takeawayToken || order.orderNumber,
        type: order.type,
        tableLabel: order.table?.name,
        cashierName: session.cashierName ?? undefined,
        tenantName: session.restaurantName || 'Dineiz',
        branchName: session?.branchName || 'Main Branch',
        createdAt: order.createdAt,
        items: order.items.map((oi) => ({
          name: oi.name,
          quantity: oi.quantity,
          variationName: oi.variation ?? undefined,
          addOnNames: oi.addons,
        })),
      } as any);
      toast.success(`KOT reprinted for #${order.orderNumber}`);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to reprint KOT. Check printer connection.');
    } finally {
      setIsReprinting(false);
    }
  };

  const toggleItem = (id: string) => {
    setToggledItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    const calcTime = () => {
      const diffMs = Date.now() - new Date(order.createdAt).getTime();
      setElapsedSecs(Math.floor(diffMs / 1000));
    };
    calcTime();
    const int = setInterval(calcTime, 1000);
    return () => clearInterval(int);
  }, [order.createdAt]);

  const elapsedMin = Math.floor(elapsedSecs / 60);
  const elapsedSecRem = elapsedSecs % 60;
  let timeStr = `${elapsedMin}:${elapsedSecRem.toString().padStart(2, '0')}`;
  if (elapsedMin >= 60) {
    timeStr = `${Math.floor(elapsedMin / 60)}h ${elapsedMin % 60}m`;
  }

  const handleMarkReady = () => {
    setIsSlidingOut(true);

    // Fire the PATCH immediately in the background — it no longer gates
    // the card leaving the board. The kitchen already physically bumped
    // the order by tapping this; the 500ms slide-out below is a cosmetic
    // delay only, not a wait on the network.
    const bump = fetch(`${API_URL}/api/kds/orders/${order.id}/bump`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      credentials: 'include',
    }).then((res) => {
      if (!res.ok) throw new Error('Failed to bump order');
    });

    setTimeout(() => {
      toast.success(`Order #${order.orderNumber} bumped`);
      onReady(order.id);
    }, 500);

    bump.catch(() => {
      toast.error(`Order #${order.orderNumber} failed to bump — restored`);
      onReadyFailed(order);
    });
  };

  let typeBadgeColor = 'border-blue-500 text-blue-400 bg-blue-500/10';
  if (order.type === 'TAKEAWAY') typeBadgeColor = 'border-purple-500 text-purple-400 bg-purple-500/10';
  if (order.type === 'DELIVERY') typeBadgeColor = 'border-orange-500 text-orange-400 bg-orange-500/10';

  let headerBg = 'bg-[#eab308]';
  let headerText = 'text-black';
  if (elapsedMin >= rushThreshold) {
    headerBg = 'bg-red-500 pulse-red';
    headerText = 'text-white';
  } else if (elapsedMin >= 10) {
    headerBg = 'bg-amber-500';
  }

  return (
    <article className={`bg-white rounded-xl shadow-md border border-[#E2E8F0] flex flex-col h-[340px] overflow-hidden ${isSlidingOut ? 'slide-out' : ''}`}>
      {/* Header */}
      <div className={`${headerBg} ${headerText} p-3 flex justify-between items-center transition-colors duration-500 shrink-0`}>
        <div className="flex items-baseline gap-2">
          <h3 className="text-[20px] font-bold">#{order.orderNumber}</h3>
          {order.takeawayToken && <span className="text-[14px] font-medium opacity-80">#{order.takeawayToken}</span>}
        </div>
        <div className="flex items-center gap-1.5 bg-black/20 px-2.5 py-1 rounded-full text-[14px] font-bold shadow-sm">
          <span className="material-symbols-outlined text-[16px]">schedule</span>
          <span>{timeStr}</span>
        </div>
      </div>
      
      <div className="p-3 flex flex-col flex-1 overflow-hidden">
        <div className="flex justify-between items-center mb-3 shrink-0">
          <span className={`px-2 py-0.5 rounded border text-[10px] font-bold tracking-widest uppercase ${typeBadgeColor}`}>
            {order.type.replace('-', ' ')}
          </span>
          <div className="flex items-center gap-1.5 text-[#eab308] text-[12px] font-bold">
            <span className="material-symbols-outlined text-[16px]">restaurant_menu</span>
            <span>Cooking</span>
          </div>
        </div>
        
        {/* Items */}
        <div className="flex-1 space-y-2 overflow-y-auto min-h-[100px] custom-scrollbar pr-1 relative">
          {order.items.map(oi => {
            const checked = toggledItems[oi.id];
            
            return (
              <div 
                key={oi.id} 
                className={`bg-[#F8FAFC] rounded-md p-2 flex items-start gap-2.5 cursor-pointer transition-all border border-transparent hover:border-[#E2E8F0] ${checked ? 'opacity-50' : ''}`} 
                onClick={() => toggleItem(oi.id)}
              >
                <div className={`text-[#0F172A] font-bold text-[14px] w-7 h-7 rounded flex items-center justify-center shrink-0 shadow-sm transition-colors ${checked ? 'bg-[#E2E8F0] border-transparent' : 'bg-white border border-[#E2E8F0]'}`}>
                  {oi.quantity}
                </div>
                <div className="flex-1 pt-0.5">
                  <p className={`text-[14px] font-medium leading-tight transition-colors ${checked ? 'line-through text-[#64748B]' : 'text-[#0F172A]'}`}>
                    {oi.name}
                  </p>
                  {(oi.variation || (oi.addons && oi.addons.length > 0)) && (
                    <p className={`text-[11px] italic mt-0.5 transition-colors ${checked ? 'line-through text-[#94A3B8]' : 'text-[#64748B]'}`}>
                      {[oi.variation, ...(oi.addons || [])].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
                <div className={`mt-0.5 flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full border-2 transition-colors ${checked ? 'border-green-500 bg-green-500 text-white' : 'border-[#CBD5E1] bg-white'}`}>
                  {checked && <Check size={12} strokeWidth={3} />}
                </div>
              </div>
            );
          })}
          
          {/* Scroll indicator fade */}
          <div className="sticky bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-white to-transparent pointer-events-none" />
        </div>
      </div>

      {/* Footer Buttons */}
      <div className="p-3 bg-[#F8FAFC] flex flex-row gap-2 shrink-0 border-t border-[#E2E8F0]">
        <button
          onClick={handleReprintKOT}
          disabled={isReprinting}
          className="flex-[0.8] py-2 rounded-md border border-[#CBD5E1] text-[#475569] text-[13px] font-semibold flex justify-center items-center gap-1.5 hover:bg-[#F1F5F9] transition-colors disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[16px]">{isReprinting ? 'hourglass_top' : 'print'}</span>
          KOT
        </button>
        <button
          onClick={handleMarkReady}
          className="flex-[1.2] py-2 rounded-md bg-[#10b981] hover:bg-[#059669] text-white text-[13px] font-bold flex justify-center items-center gap-1.5 shadow-sm transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">check_circle</span>
          Bump
        </button>
      </div>
    </article>
  );
}
