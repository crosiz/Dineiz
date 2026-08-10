'use client';
import React, { useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { Download } from 'lucide-react';
import Papa from 'papaparse';

function formatPKR(val: number) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(val);
}

export function MenuPerformance({ data }: { data: any[] }) {
  const [groupBy, setGroupBy] = useState<'item' | 'category'>('item');

  if (!data || data.length === 0) return null;

  // Process data
  const top10Qty = [...data].sort((a, b) => b.qty - a.qty).slice(0, 10);
  const top10Rev = [...data].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  const bottom10 = [...data].sort((a, b) => a.qty - b.qty).slice(0, 10);

  // Grouping logic for table
  let tableData = data;
  if (groupBy === 'category') {
    const catMap: any = {};
    for (const d of data) {
      const cat = d.categoryId || 'Uncategorized';
      if (!catMap[cat]) catMap[cat] = { name: cat, qty: 0, revenue: 0, categoryId: cat };
      catMap[cat].qty += d.qty;
      catMap[cat].revenue += d.revenue;
    }
    tableData = Object.values(catMap);
  }
  
  tableData.sort((a, b) => b.revenue - a.revenue);
  const totalRev = tableData.reduce((sum, d) => sum + d.revenue, 0) || 1;

  const renderChart = (title: string, chartData: any[], dataKey: string, color: string, isPkr = false) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex-1 min-w-[300px]">
      <h3 className="text-sm font-bold text-slate-800 mb-4">{title}</h3>
      <div className="h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
            <XAxis type="number" tickFormatter={(v) => isPkr ? `${v/1000}k` : v} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
            <YAxis dataKey="name" type="category" width={90} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#475569', fontWeight: 500 }} />
            <Tooltip 
              formatter={(val: number) => isPkr ? formatPKR(val) : val}
              cursor={{ fill: '#f8fafc' }}
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Bar dataKey={dataKey} fill={color} radius={[0, 4, 4, 0]} barSize={16}>
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const handleExportCSV = () => {
    const csv = Papa.unparse(tableData.map((d: any) => ({
      Name: d.name,
      Category: groupBy === 'item' ? (d.categoryId || 'Uncategorized') : undefined,
      'Units Sold': d.qty,
      'Revenue (PKR)': d.revenue,
      '% of Total': ((d.revenue / totalRev) * 100).toFixed(1) + '%'
    })));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Menu_Performance_${new Date().getTime()}.csv`;
    link.click();
  };

  return (
    <section className="space-y-6">
      <h2 className="text-lg font-bold text-slate-800">Menu Performance</h2>
      
      {/* 3 Charts */}
      <div className="flex flex-col lg:flex-row gap-6">
        {renderChart('Top 10 by Quantity', top10Qty, 'qty', '#3b82f6')}
        {renderChart('Top 10 by Revenue', top10Rev, 'revenue', '#10b981')}
        {renderChart('Bottom 10 Items', bottom10, 'qty', '#f43f5e')}
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-bold text-slate-800">Full Menu Breakdown</h3>
          <div className="flex items-center gap-4">
            <select 
              value={groupBy}
              onChange={e => setGroupBy(e.target.value as any)}
              className="text-sm font-medium border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 outline-none"
            >
              <option value="item">Group by Item</option>
              <option value="category">Group by Category</option>
            </select>
            <button 
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors no-print"
            >
              <Download size={14} />
              Export
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto max-h-[400px]">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-white sticky top-0 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
              <tr>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase text-[11px] tracking-wider">Name</th>
                {groupBy === 'item' && <th className="px-6 py-4 font-bold text-slate-500 uppercase text-[11px] tracking-wider">Category</th>}
                <th className="px-6 py-4 font-bold text-slate-500 uppercase text-[11px] tracking-wider text-right">Units Sold</th>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase text-[11px] tracking-wider text-right">Revenue</th>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase text-[11px] tracking-wider text-right">% of Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tableData.map((d, i) => {
                const pct = ((d.revenue / totalRev) * 100).toFixed(1);
                return (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-800">{d.name}</td>
                    {groupBy === 'item' && <td className="px-6 py-4 text-slate-500">{d.categoryId || '-'}</td>}
                    <td className="px-6 py-4 text-right font-medium text-slate-700">{d.qty}</td>
                    <td className="px-6 py-4 text-right font-medium text-slate-800">{formatPKR(d.revenue)}</td>
                    <td className="px-6 py-4 text-right text-slate-500">
                      <div className="flex items-center justify-end gap-2">
                        <span>{pct}%</span>
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
