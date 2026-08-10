'use client';
import React, { useMemo } from 'react';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function BusyPeriodCalendar({ data }: { data: Record<string, Record<string, number>> }) {
  const SHIFTS = [
    { name: '6am - 11am', hours: [6, 7, 8, 9, 10] },
    { name: '11am - 3pm', hours: [11, 12, 13, 14] },
    { name: '3pm - 6pm', hours: [15, 16, 17] },
    { name: '6pm - 10pm', hours: [18, 19, 20, 21] },
    { name: '10pm - 2am', hours: [22, 23, 0, 1, 2] }
  ];

  // Aggregate data by shift
  const shiftData = useMemo(() => {
    const res: Record<number, Record<string, number>> = {};
    for (let d = 0; d < 7; d++) {
      res[d] = {};
      for (const shift of SHIFTS) {
        let total = 0;
        for (const h of shift.hours) {
          total += data[d]?.[h] || 0;
        }
        res[d][shift.name] = total;
      }
    }
    return res;
  }, [data]);

  // Find max value to calculate intensity
  const maxVal = useMemo(() => {
    let m = 0;
    for (let d = 0; d < 7; d++) {
      for (const shift of SHIFTS) {
        if (shiftData[d][shift.name] > m) m = shiftData[d][shift.name];
      }
    }
    return Math.max(m, 1);
  }, [shiftData]);

  const peak = useMemo(() => {
    let max = -1;
    let peakDay = 0;
    let peakShift = '';
    for (let d = 0; d < 7; d++) {
      for (const shift of SHIFTS) {
        if (shiftData[d][shift.name] > max) {
          max = shiftData[d][shift.name];
          peakDay = d;
          peakShift = shift.name;
        }
      }
    }
    return { day: peakDay, shift: peakShift, val: max };
  }, [shiftData]);

  const getIntensityClass = (val: number) => {
    const ratio = val / maxVal;
    if (ratio === 0) return 'bg-slate-50 border-slate-100 text-transparent';
    if (ratio < 0.2) return 'bg-brand-primary/10 border-brand-primary/20 text-brand-primary/60';
    if (ratio < 0.5) return 'bg-brand-primary/40 border-brand-primary/50 text-white';
    if (ratio < 0.8) return 'bg-brand-primary/70 border-brand-primary/80 text-white';
    return 'bg-brand-primary border-brand-primary text-white shadow-sm';
  };

  return (
    <div>
      {peak.val > 0 && (
        <div className="mb-6 bg-slate-50 border border-slate-100 p-4 rounded-xl flex items-start sm:items-center gap-3">
          <div className="w-1.5 h-1.5 bg-brand-primary rounded-full mt-2 sm:mt-0" />
          <p className="text-slate-600 text-sm font-medium">
            Peak period expected on <strong className="text-slate-900">{DAYS[peak.day]} {peak.shift}</strong> with ~<strong className="text-slate-900">{peak.val} orders</strong>.
          </p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead>
            <tr>
              <th className="p-2 w-24"></th>
              {SHIFTS.map(s => (
                <th key={s.name} className="p-2 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">{s.name}</th>
              ))}
            </tr>
          </thead>
          <tbody className="space-y-2">
            {DAYS.map((day, d) => (
              <tr key={day} className="border-b border-slate-50 last:border-0">
                <td className="p-2 text-sm font-semibold text-slate-700">{day.slice(0, 3)}</td>
                {SHIFTS.map(shift => {
                  const val = shiftData[d][shift.name];
                  return (
                    <td key={shift.name} className="p-1">
                      <div 
                        title={`${day} ${shift.name}: ~${val} orders`}
                        className={`h-12 rounded-lg border text-sm flex flex-col items-center justify-center font-bold transition-all cursor-help ${getIntensityClass(val)}`}
                      >
                        {val > 0 ? val : ''}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
