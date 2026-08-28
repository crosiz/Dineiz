import React from 'react';
import { Phone, MessageSquare } from 'lucide-react';

export function RidersList({ riders, isLoading }: any) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 skeleton-shimmer border border-slate-100 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-100 rounded-xl flex flex-col shadow-sm h-[700px] overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
        <h3 className="font-bold text-[14px] text-slate-900">Rider Status</h3>
      </div>

      <div className="overflow-auto flex-1">
        <table className="w-full text-left">
          <thead className="border-b border-slate-100 text-[11px] uppercase text-slate-500 font-bold tracking-wider sticky top-0 bg-white z-10">
            <tr>
              <th className="px-6 py-4">Rider</th>
              <th className="px-6 py-4">Status & Work</th>
              <th className="px-6 py-4 text-right">Contact</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {riders.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-12 text-center">
                  <div className="text-[13px] font-bold text-slate-900">No riders configured.</div>
                </td>
              </tr>
            ) : (
              riders.map((rider: any) => {
                const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

                const statusColor = 
                  rider.status === 'ON_DUTY' || rider.status === 'AVAILABLE' ? 'bg-emerald-500' :
                  rider.status === 'ON_DELIVERY' ? 'bg-amber-500' :
                  'bg-gray-400';

                const statusText = 
                  rider.status === 'ON_DUTY' || rider.status === 'AVAILABLE' ? 'On Duty' :
                  rider.status === 'ON_DELIVERY' ? 'On Delivery' :
                  'Off Duty';

                return (
                  <tr key={rider.id} className="hover:bg-slate-50/50 transition-colors">
                    {/* Rider Info */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[12px]">
                            {getInitials(rider.name)}
                          </div>
                          <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-white rounded-full ${statusColor}`} />
                        </div>
                        <div>
                          <div className="font-bold text-[13px] text-slate-900">{rider.name}</div>
                          <div className="text-[12px] text-slate-500">{rider.phone}</div>
                        </div>
                      </div>
                    </td>

                    {/* Status & Work */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${statusColor}`}></div>
                          <span className="text-[12px] font-bold text-slate-600">{statusText}</span>
                        </div>
                        <div className="text-[12px] font-medium text-slate-500">
                          {rider.activeDeliveries > 0 ? (
                            <span className="text-amber-600 font-bold">{rider.activeDeliveries} Active</span>
                          ) : (
                            <span>{rider.completedDeliveries} Completed</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Contact Actions */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <a href={`tel:${rider.phone || ''}`} className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                        <a href={`https://wa.me/${(rider.phone || '').replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
                          <MessageSquare className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
