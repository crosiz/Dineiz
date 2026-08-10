import { create } from 'zustand';
import { format, subDays, startOfMonth, subMonths, endOfMonth } from 'date-fns';

type PeriodType = 'today' | 'yesterday' | '7d' | '30d' | 'thisMonth' | 'lastMonth' | 'custom';

interface AnalyticsState {
  period: PeriodType;
  startDate: string;
  endDate: string;
  autoRefreshInterval: number; // 0 = off, 5 = 5min, 15 = 15min
  setPeriod: (period: PeriodType) => void;
  setCustomDateRange: (start: string, end: string) => void;
  setAutoRefreshInterval: (interval: number) => void;
}

export const useAnalyticsStore = create<AnalyticsState>((set) => ({
  period: 'today',
  startDate: format(new Date(), 'yyyy-MM-dd'),
  endDate: format(new Date(), 'yyyy-MM-dd'),
  autoRefreshInterval: 0,
  
  setPeriod: (period) => {
    const today = new Date();
    let startDate = format(today, 'yyyy-MM-dd');
    let endDate = format(today, 'yyyy-MM-dd');

    if (period === 'yesterday') {
      startDate = format(subDays(today, 1), 'yyyy-MM-dd');
      endDate = startDate;
    } else if (period === '7d') {
      startDate = format(subDays(today, 6), 'yyyy-MM-dd');
    } else if (period === '30d') {
      startDate = format(subDays(today, 29), 'yyyy-MM-dd');
    } else if (period === 'thisMonth') {
      startDate = format(startOfMonth(today), 'yyyy-MM-dd');
    } else if (period === 'lastMonth') {
      const lm = subMonths(today, 1);
      startDate = format(startOfMonth(lm), 'yyyy-MM-dd');
      endDate = format(endOfMonth(lm), 'yyyy-MM-dd');
    }

    set({ period, startDate, endDate });
  },

  setCustomDateRange: (start, end) => set({ period: 'custom', startDate: start, endDate: end }),
  setAutoRefreshInterval: (interval) => set({ autoRefreshInterval: interval }),
}));
