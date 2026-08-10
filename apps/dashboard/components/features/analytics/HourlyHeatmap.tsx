'use client';

import React from 'react';

export function HourlyHeatmap() {
  // Generate mock heatmap data for 7 days, 16 hours
  const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  const hours = ['9AM', '1PM', '5PM', '9PM'];
  
  const getIntensityClass = (row: number, col: number) => {
    // Make Saturday evening the peak
    if (row === 5 && col >= 10 && col <= 12) return 'bg-orange-600';
    if (row === 5 && col > 8) return 'bg-orange-500';
    if (row === 6 && col > 8) return 'bg-orange-400';
    if (row === 4 && col > 10) return 'bg-orange-500';
    
    // Lunch rush
    if (col >= 4 && col <= 6) return Math.random() > 0.5 ? 'bg-orange-400' : 'bg-orange-300';
    
    // Dinner rush
    if (col >= 10 && col <= 13) return Math.random() > 0.5 ? 'bg-orange-500' : 'bg-orange-300';
    
    // Slow times
    return Math.random() > 0.7 ? 'bg-orange-300' : 'bg-orange-100';
  };

  return (
    <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm flex flex-col h-full">
      <div className="flex items-start justify-between mb-6">
        <h3 className="text-base font-bold text-slate-900">Hourly Heatmap</h3>
        <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-100 uppercase tracking-wider">Peak: 7:00 PM</span>
      </div>

      <div className="flex-1 flex flex-col justify-center">
        <div className="flex">
          {/* Y Axis - Days */}
          <div className="flex flex-col justify-between pr-3 text-[10px] text-slate-400 font-semibold py-1">
            {days.map(d => <span key={d} className="h-6 flex items-center">{d}</span>)}
          </div>
          
          {/* Grid */}
          <div className="flex-1 flex flex-col justify-between py-1">
            {days.map((d, rowIndex) => (
              <div key={`row-${rowIndex}`} className="flex gap-1 h-6">
                {Array.from({ length: 16 }).map((_, colIndex) => (
                  <div 
                    key={`cell-${rowIndex}-${colIndex}`} 
                    className={`flex-1 rounded-sm ${getIntensityClass(rowIndex, colIndex)} hover:opacity-80 transition-opacity cursor-pointer`}
                    title={`${d} at ${colIndex + 8}:00`}
                  ></div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* X Axis - Hours */}
        <div className="flex justify-between pl-10 pr-2 mt-3 text-[10px] text-slate-400 font-semibold">
          {hours.map(h => <span key={h}>{h}</span>)}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-2 mt-4 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
        <span>Low</span>
        <div className="flex gap-0.5">
          <div className="w-3 h-3 rounded-sm bg-orange-100"></div>
          <div className="w-3 h-3 rounded-sm bg-orange-300"></div>
          <div className="w-3 h-3 rounded-sm bg-orange-500"></div>
          <div className="w-3 h-3 rounded-sm bg-orange-600"></div>
        </div>
        <span>High</span>
      </div>
    </div>
  );
}
