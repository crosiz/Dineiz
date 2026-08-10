'use client';
import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart, ReferenceLine } from 'recharts';
import { format, parseISO } from 'date-fns';

export function RevenueForecastChart({ data }: { data: any }) {
  const chartData = useMemo(() => {
    if (!data.actuals || !data.predictions) return [];

    const merged = [];
    
    // Add actuals
    for (const act of data.actuals) {
      merged.push({
        date: act.ds,
        actual: act.y,
        forecast: null,
        lower: null,
        upper: null,
        isForecast: false
      });
    }

    // Connect the last actual to the first forecast for a continuous line
    if (merged.length > 0 && data.predictions.length > 0) {
      const lastActual = merged[merged.length - 1];
      const firstPred = data.predictions[0];
      // We can push a transition point, or just let recharts handle the gap 
      // Actually, standard way is to have the last actual also be the first forecast point
      merged[merged.length - 1].forecast = lastActual.actual;
      merged[merged.length - 1].lower = lastActual.actual;
      merged[merged.length - 1].upper = lastActual.actual;
    }

    // Add predictions
    for (const pred of data.predictions) {
      merged.push({
        date: pred.ds,
        actual: null,
        forecast: Math.round(pred.yhat),
        lower: Math.round(pred.yhat_lower),
        upper: Math.round(pred.yhat_upper),
        isForecast: true
      });
    }

    return merged;
  }, [data]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const isF = payload[0].payload.isForecast;
      return (
        <div className="bg-white p-4 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-100 text-sm min-w-[200px]">
          <p className="font-bold text-slate-800 mb-3 pb-2 border-b border-slate-100">{format(parseISO(label), 'MMMM d, yyyy')}</p>
          {isF ? (
            <>
              <p className="text-brand-primary font-bold flex justify-between items-center gap-4 text-base">
                <span className="text-slate-500 font-medium text-sm">Forecast</span> 
                <span>PKR {payload.find((p:any) => p.dataKey === 'forecast')?.value?.toLocaleString()}</span>
              </p>
              <p className="text-slate-400 text-xs mt-2 flex justify-between">
                <span>Expected Range</span>
                <span>PKR {payload.find((p:any) => p.dataKey === 'lower')?.value?.toLocaleString()} - {payload.find((p:any) => p.dataKey === 'upper')?.value?.toLocaleString()}</span>
              </p>
            </>
          ) : (
            <p className="text-slate-800 font-bold flex justify-between items-center gap-4 text-base">
              <span className="text-slate-500 font-medium text-sm">Actual Revenue</span> 
              <span>PKR {payload.find((p:any) => p.dataKey === 'actual')?.value?.toLocaleString()}</span>
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  const today = format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="h-[400px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2}/>
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis 
            dataKey="date" 
            tickFormatter={(val) => format(parseISO(val), 'MMM d')} 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 12, fill: '#64748b' }}
            dy={10}
            minTickGap={30}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 12, fill: '#64748b' }}
            tickFormatter={(val) => `PKR ${(val/1000)}k`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }} />
          
          <ReferenceLine x={today} stroke="#94a3b8" strokeDasharray="3 3" label={{ position: 'top', value: 'Today', fill: '#94a3b8', fontSize: 12, fontWeight: 500 }} />

          {/* Confidence interval band */}
          <Area type="monotone" dataKey="upper" stroke="none" fill="url(#colorForecast)" connectNulls />
          <Area type="monotone" dataKey="lower" stroke="none" fill="#ffffff" connectNulls />
          
          <Line type="monotone" dataKey="actual" stroke="#0f172a" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#0f172a', stroke: '#fff', strokeWidth: 2 }} connectNulls />
          <Line type="monotone" dataKey="forecast" stroke="#8b5cf6" strokeWidth={3} strokeDasharray="6 6" dot={false} activeDot={{ r: 6, fill: '#8b5cf6', stroke: '#fff', strokeWidth: 2 }} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
