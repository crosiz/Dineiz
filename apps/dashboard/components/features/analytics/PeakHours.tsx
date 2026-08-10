'use client';
import React from 'react';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// 18 rows: 8 AM to 1 AM (which is 18 hours: 8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,0,1)
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1];

function formatHour(h: number) {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr} ${ampm}`;
}

export function PeakHours({ data }: { data: number[][] }) {
  if (!data) return null;

  // data is [7][24]. We only want [7][18 specific hours]
  let maxOrders = 0;
  const grid = DAYS.map((_, d) => 
    HOURS.map(h => {
      const val = data[d][h] || 0;
      if (val > maxOrders) maxOrders = val;
      return { val, h, d };
    })
  );

  // Find top 5 and bottom 5 (non-zero or all)
  const allCells = grid.flat();
  allCells.sort((a, b) => b.val - a.val);
  
  const top5 = allCells.slice(0, 5);
  const bottom5 = [...allCells].reverse().slice(0, 5);

  return (
    <section className="space-y-6">
      <h2 className="text-lg font-bold text-slate-800">Peak Hours & Days</h2>
      
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col lg:flex-row gap-8">
        
        {/* Heatmap Grid */}
        <div className="flex-1 overflow-x-auto">
          <div className="min-w-[600px]">
            <div className="grid grid-cols-[60px_repeat(7,1fr)] gap-1 mb-2">
              <div />
              {DAYS.map(d => (
                <div key={d} className="text-center text-xs font-bold text-slate-500">{d}</div>
              ))}
            </div>
            
            <div className="flex flex-col gap-1">
              {HOURS.map((h, rowIdx) => (
                <div key={h} className="grid grid-cols-[60px_repeat(7,1fr)] gap-1">
                  <div className="text-xs font-medium text-slate-400 flex items-center justify-end pr-3">
                    {formatHour(h)}
                  </div>
                  {DAYS.map((_, colIdx) => {
                    const val = grid[colIdx][rowIdx].val;
                    const opacity = maxOrders > 0 ? Math.max(0.05, val / maxOrders) : 0.05;
                    return (
                      <div 
                        key={`${colIdx}-${h}`} 
                        className="h-8 rounded cursor-pointer transition-transform hover:scale-110 relative group"
                        style={{ backgroundColor: `rgba(255, 87, 34, ${opacity})` }}
                      >
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 w-max bg-slate-900 text-white text-xs py-1 px-2 rounded shadow-lg">
                          {DAYS[colIdx]} {formatHour(h)}: {val} orders
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Highlights */}
        <div className="w-full lg:w-64 shrink-0 flex flex-col gap-6">
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-500" /> Busiest Hours
            </h3>
            <div className="space-y-2">
              {top5.map((c, i) => (
                <div key={i} className="flex justify-between items-center text-sm">
                  <span className="text-slate-600 font-medium">{DAYS[c.d]} {formatHour(c.h)}</span>
                  <span className="font-bold text-slate-800">{c.val}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-200" /> Slowest Hours
            </h3>
            <div className="space-y-2">
              {bottom5.map((c, i) => (
                <div key={i} className="flex justify-between items-center text-sm">
                  <span className="text-slate-600 font-medium">{DAYS[c.d]} {formatHour(c.h)}</span>
                  <span className="font-bold text-slate-800">{c.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        
      </div>
    </section>
  );
}
