'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, LabelList,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import { formatPKR, formatAxisPKR } from '@/lib/formatters';
import { ChartSkeleton, InlineError } from '@/components/ui/skeleton';

// Pulled out of tenant-admin-dashboard.tsx and loaded with next/dynamic so
// recharts (~90KB) is no longer in the dashboard home's first-load bundle —
// it arrives only once this card actually needs to render a chart.
export default function RevenueTrendChart({
  trendData,
  isTrendLoading,
  isTrendFetching,
  isTrendError,
  refetchTrend,
  trendPeriod,
}: {
  trendData: any;
  isTrendLoading: boolean;
  isTrendFetching: boolean;
  isTrendError: boolean;
  refetchTrend: () => void;
  trendPeriod: string;
}) {
  const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3.5 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-100 text-sm min-w-[160px]">
          <p className="font-semibold text-slate-400 text-[11px] uppercase tracking-wide mb-2 pb-2 border-b border-slate-100">{label}</p>
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-slate-500 text-xs font-medium">Revenue</span>
            <span className="text-slate-900 font-bold text-base tabular-nums">{formatPKR(payload[0].value)}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  const trend = trendData || [];
  const hasRevenue = trend.some((d: any) => (d.revenue ?? 0) > 0);
  const peakIndex = trend.reduce(
    (maxI: number, d: any, i: number) => (d.revenue > (trend[maxI]?.revenue ?? -Infinity) ? i : maxI),
    0,
  );

  // Direct-labels only the peak bar (the "extreme") — every other value stays
  // reachable via the axis and the tooltip.
  const PeakLabel = (labelProps: any) => {
    const { x, y, width, value, index } = labelProps;
    if (index !== peakIndex || !value) return null;
    return (
      <text x={x + width / 2} y={y - 8} textAnchor="middle" fontSize={11} fontWeight={700} fill="#0F172A">
        {formatAxisPKR(value)}
      </text>
    );
  };

  if (isTrendLoading) return <ChartSkeleton height={220} />;
  if (isTrendError) return <div className="flex-1"><InlineError onRetry={refetchTrend} /></div>;
  if (!hasRevenue) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-2">
        <BarChart3 className="w-6 h-6 text-slate-300" />
        <p className="text-sm text-slate-400">
          No revenue recorded {trendPeriod === 'today' ? 'today' : 'in this period'} yet
        </p>
      </div>
    );
  }

  return (
    <div className={`flex-1 transition-opacity duration-200 ${isTrendFetching ? 'opacity-40' : 'opacity-100'}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={trend} margin={{ top: 18, right: 4, left: -16, bottom: 0 }}>
          <CartesianGrid horizontal vertical={false} stroke="#F1F5F9" strokeDasharray="0" />
          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} dy={10} />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={formatAxisPKR} width={44} />
          <RTooltip content={<CustomBarTooltip />} cursor={{ fill: '#F8FAFC' }} />
          <Bar
            dataKey="revenue"
            fill="var(--color-primary)"
            radius={[4, 4, 0, 0]}
            maxBarSize={22}
            activeBar={{ fill: 'var(--color-primary)', stroke: '#fff', strokeWidth: 2 }}
          >
            <LabelList dataKey="revenue" content={PeakLabel} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
