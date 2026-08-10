import React, { useState } from 'react';
import { Clock, Phone, Navigation } from 'lucide-react';
import { assignRiderToOrder, updateDeliveryStatus } from '@/lib/api/fleet';
import { toast } from 'sonner';
import { Pagination } from '@/components/ui/Pagination';

export function DeliveryOrdersList({ deliveries, riders, onUpdate, isLoading }: any) {
  const [filter, setFilter] = useState('UNASSIGNED');
  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const filteredDeliveries = deliveries.filter((d: any) => {
    if (filter === 'ALL') return true;
    if (filter === 'UNASSIGNED') return !d.riderAssignment || d.riderAssignment.status === 'UNASSIGNED';
    if (filter === 'IN_TRANSIT') return d.riderAssignment && ['ASSIGNED', 'PICKED_UP'].includes(d.riderAssignment.status);
    if (filter === 'DELIVERED') return d.riderAssignment?.status === 'COMPLETED';
    return true;
  });

  const totalPages = Math.ceil(filteredDeliveries.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedDeliveries = filteredDeliveries.slice(startIndex, startIndex + pageSize);

  const handleAssign = async (orderId: string, riderId: string) => {
    setAssigningOrderId(null);
    try {
      await assignRiderToOrder(orderId, riderId);
      toast.success('Rider assigned');
      onUpdate();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      await updateDeliveryStatus(orderId, newStatus);
      toast.success('Status updated');
      onUpdate();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (isLoading) {
    return <div className="animate-pulse space-y-4"><div className="h-20 bg-gray-100 rounded-xl" /></div>;
  }

  const unassignedCount = deliveries.filter((d: any) => !d.riderAssignment || d.riderAssignment.status === 'UNASSIGNED').length;

  return (
    <div className="bg-white border border-slate-100 rounded-xl flex flex-col shadow-sm h-[700px] overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex gap-4">
        <button onClick={() => { setFilter('UNASSIGNED'); setCurrentPage(1); }} className={`text-[13px] font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${filter === 'UNASSIGNED' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}>
          UNASSIGNED
          {unassignedCount > 0 && <span className="bg-[#ff5722] text-white text-[10px] px-1.5 py-0.5 rounded-full">{unassignedCount}</span>}
        </button>
        <button onClick={() => { setFilter('IN_TRANSIT'); setCurrentPage(1); }} className={`text-[13px] font-bold px-4 py-2 rounded-lg transition-colors ${filter === 'IN_TRANSIT' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}>
          IN TRANSIT
        </button>
        <button onClick={() => { setFilter('DELIVERED'); setCurrentPage(1); }} className={`text-[13px] font-bold px-4 py-2 rounded-lg transition-colors ${filter === 'DELIVERED' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}>
          DELIVERED
        </button>
        <button onClick={() => { setFilter('ALL'); setCurrentPage(1); }} className={`text-[13px] font-bold px-4 py-2 rounded-lg transition-colors ${filter === 'ALL' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}>
          ALL
        </button>
      </div>

      <div className="overflow-auto flex-1">
        <table className="w-full text-left">
          <thead className="border-b border-slate-100 text-[11px] uppercase text-slate-500 font-bold tracking-wider sticky top-0 bg-white z-10">
            <tr>
              <th className="px-6 py-4">Order</th>
              <th className="px-6 py-4">Customer & Address</th>
              <th className="px-6 py-4">Total</th>
              <th className="px-6 py-4">Assignment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedDeliveries.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-12 text-center">
                  <div className="text-[13px] font-bold text-slate-900">No deliveries found.</div>
                </td>
              </tr>
            ) : (
              paginatedDeliveries.map((order: any) => {
                const minutesElapsed = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000);
                const timeColor = minutesElapsed > 35 ? 'text-red-600 bg-red-50' : minutesElapsed > 20 ? 'text-amber-600 bg-amber-50' : 'text-emerald-600 bg-emerald-50';
                const assignmentStatus = order.riderAssignment?.status || 'UNASSIGNED';

                return (
                  <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                    {/* Order Details */}
                    <td className="px-6 py-4">
                      <div className="font-bold text-[13px] text-slate-900">{order.orderNumber}</div>
                      <div className={`mt-1 inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${timeColor}`}>
                        <Clock className="w-3 h-3" /> {minutesElapsed}m
                      </div>
                    </td>

                    {/* Customer & Address */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[13px] text-slate-900">{order.customer?.name || 'Walk-in'}</span>
                          <span className="text-[13px] text-slate-500">{order.customer?.phone}</span>
                        </div>
                        <div className="text-[13px] text-slate-600 mt-0.5 flex items-start gap-1">
                          <Navigation className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                          <span className="truncate max-w-[200px] leading-snug">{order.deliveryAddress || 'No address'}</span>
                        </div>
                      </div>
                    </td>

                    {/* Total */}
                    <td className="px-6 py-4">
                      <div className="font-bold text-[13px] text-slate-900">PKR {order.netAmount.toLocaleString()}</div>
                      <div className="text-[12px] text-slate-500 mt-0.5 truncate max-w-[150px]">
                        {order.items.slice(0, 2).map((i: any) => `${i.quantity}x ${i.item?.name}`).join(', ')}
                        {order.items.length > 2 && ' ...'}
                      </div>
                    </td>

                    {/* Assignment */}
                    <td className="px-6 py-4">
                      {assignmentStatus === 'UNASSIGNED' ? (
                        <div className="relative">
                          <button 
                            onClick={() => setAssigningOrderId(assigningOrderId === order.id ? null : order.id)}
                            className="bg-slate-100 text-slate-700 text-[12px] font-bold px-3 py-1.5 rounded-lg hover:bg-slate-200 transition-colors"
                          >
                            Assign Rider
                          </button>
                          {assigningOrderId === order.id && (
                            <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-100 shadow-xl rounded-xl overflow-hidden z-20">
                              <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 text-[10px] uppercase font-bold tracking-wider text-slate-500">Available Riders</div>
                              <div className="max-h-48 overflow-y-auto">
                                {riders.map((r: any) => (
                                  <button 
                                    key={r.id} 
                                    onClick={() => handleAssign(order.id, r.id)}
                                    className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex justify-between items-center transition-colors border-b border-slate-50 last:border-0"
                                  >
                                    <span className="font-bold text-[13px] text-slate-900">{r.name}</span>
                                    <span className={`text-[11px] font-bold ${r.activeDeliveries > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                      {r.activeDeliveries} active
                                    </span>
                                  </button>
                                ))}
                                {riders.length === 0 && <div className="p-3 text-[12px] font-medium text-slate-500">No riders found.</div>}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-medium text-slate-500">Rider:</span>
                            <span className="text-[13px] font-bold text-slate-900">{order.riderAssignment.rider?.name || 'Rider'}</span>
                          </div>
                          <select 
                            className={`text-[11px] uppercase tracking-wider font-bold px-2 py-1 rounded-md border-0 focus:ring-2 cursor-pointer w-fit
                              ${assignmentStatus === 'ASSIGNED' ? 'bg-amber-50 text-amber-700' : ''}
                              ${assignmentStatus === 'PICKED_UP' ? 'bg-blue-50 text-blue-700' : ''}
                              ${assignmentStatus === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' : ''}
                            `}
                            value={assignmentStatus}
                            onChange={(e) => handleStatusChange(order.id, e.target.value)}
                          >
                            <option value="ASSIGNED">READY</option>
                            <option value="PICKED_UP">PICKED UP</option>
                            <option value="COMPLETED">DELIVERED</option>
                          </select>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination Footer */}
      {!isLoading && filteredDeliveries.length > 0 && (
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-[13px] text-slate-500 bg-white">
          <div>
            Showing <span className="font-bold text-slate-900">{Math.min(startIndex + 1, filteredDeliveries.length)}-{Math.min(startIndex + pageSize, filteredDeliveries.length)}</span> of <span className="font-bold text-slate-900">{filteredDeliveries.length}</span> deliveries
          </div>
          <Pagination 
            currentPage={currentPage} 
            totalPages={Math.max(1, totalPages)} 
            onPageChange={setCurrentPage} 
            pageSize={pageSize}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        </div>
      )}
    </div>
  );
}
