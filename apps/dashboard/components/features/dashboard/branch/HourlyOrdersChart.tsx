import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ChartSkeleton } from '@/components/ui/skeleton';

interface HourlyOrdersChartProps {
  heatmap: any;
  isLoading?: boolean;
}

export function HourlyOrdersChart({ heatmap, isLoading }: HourlyOrdersChartProps) {
  const currentHour = new Date().getHours();

  // Parse heatmap data or mock empty hours (9AM to 11PM)
  const chartData = useMemo(() => {
    const data = [];
    const heatmapMap = new Map(heatmap?.data?.map((d: any) => [d.hour, d.count]) || []);
    
    // Generate hours from 9 to 23 (9 AM to 11 PM)
    for (let i = 9; i <= 23; i++) {
      const label = i <= 12 ? `${i}AM` : `${i - 12}PM`;
      // We adjust 12PM label specifically
      const finalLabel = i === 12 ? '12PM' : label;
      
      data.push({
        hour: i,
        label: finalLabel,
        count: heatmapMap.get(i) || 0
      });
    }
    return data;
  }, [heatmap]);

  return (
    <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
      <div className="flex items-center justify-between mb-8">
        <h4 className="font-h2 text-h2 text-slate-900 font-semibold text-lg">Order Volume Analysis</h4>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 bg-primary rounded-full"></span>
          <span className="text-xs font-medium text-slate-500">Orders/Hour</span>
        </div>
      </div>
      
      <div className="h-48 w-full mt-4">
        {isLoading ? (
          <ChartSkeleton height={192} />
        ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
            <XAxis 
              dataKey="label" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }}
              interval="preserveStartEnd"
              dy={10}
            />
            <Tooltip
              cursor={{ fill: '#f8fafc' }}
              contentStyle={{ borderRadius: '0.5rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              itemStyle={{ color: '#0f172a', fontWeight: 'bold' }}
              formatter={(value: number) => [`${value} Orders`, 'Volume']}
              labelStyle={{ color: '#64748b', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.hour === currentHour ? '#ff5722' : '#ffb5a0'} 
                  fillOpacity={entry.hour === currentHour ? 1 : 0.6}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
