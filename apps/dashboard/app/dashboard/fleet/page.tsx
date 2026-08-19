'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useBranchFilter } from '@/hooks/useBranchFilter';
import { useDeliveries, useRiders } from '@/lib/api/fleet';
import { DeliveryOrdersList } from './_components/DeliveryOrdersList';
import { RidersList } from './_components/RidersList';
import { AddRiderModal } from './_components/AddRiderModal';
import { Clock, Users, Package, AlertCircle, Plus } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { API_URL } from '@/lib/api';

export default function FleetPage() {
  const { branchId } = useBranchFilter();
  const { deliveries, isLoading: isDeliveriesLoading, mutate: mutateDeliveries } = useDeliveries(branchId || undefined);
  const { riders, isLoading: isRidersLoading, mutate: mutateRiders } = useRiders(branchId || undefined);
  const socketRef = useRef<Socket | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useEffect(() => {
    if (!branchId) return;
    
    // /fleet is where emitRiderLocationUpdated / emitRiderStatusChanged /
    // emitDeliveryStageUpdated actually emit — connecting to the default
    // namespace here meant rider:status_changed and the correctly-scoped
    // delivery events never reached this page in real time.
    const socket = io(`${API_URL}/fleet`, {
      path: '/socket.io/',
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.emit('join_branch', branchId);

    const handleUpdate = () => {
      mutateDeliveries();
      mutateRiders();
    };

    socket.on('delivery:status_changed', handleUpdate);
    socket.on('order:created', handleUpdate);
    socket.on('rider:status_changed', handleUpdate);

    return () => {
      socket.disconnect();
    };
  }, [branchId, mutateDeliveries, mutateRiders]);

  const activeDeliveries = deliveries.filter((d: any) => d.status !== 'COMPLETED' && d.status !== 'CANCELLED');
  const unassignedDeliveries = activeDeliveries.filter((d: any) => !d.riderAssignment || d.riderAssignment.status === 'UNASSIGNED');
  
  const ridersOnDuty = riders.filter((r: any) => r.status === 'ON_DUTY' || r.status === 'AVAILABLE' || r.status === 'ON_DELIVERY').length;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-slate-50">
      <div className="flex-1 overflow-hidden flex flex-col p-6 lg:p-8">
        <div className="max-w-[1600px] w-full mx-auto flex flex-col h-full space-y-6">
          
          {/* PAGE HEADER */}
          <div className="flex items-start justify-between shrink-0">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 mb-1">Fleet & Delivery</h1>
              <p className="text-slate-500 text-sm">Manage your delivery operations and riders.</p>
              
              <div className="flex items-center gap-6 mt-4">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <div className="w-2 h-2 rounded-full bg-slate-400"></div> {activeDeliveries.length} Active Deliveries
                </div>
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div> {ridersOnDuty} Riders On Duty
                </div>
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <div className="w-2 h-2 rounded-full bg-orange-500"></div> {unassignedDeliveries.length} Unassigned
                </div>
              </div>
            </div>
            
            <button 
              className="bg-[#ff5722] text-white rounded-lg px-4 py-2 text-sm font-bold flex items-center gap-2 hover:bg-orange-700 transition-colors shadow-sm shrink-0"
              onClick={() => setIsAddModalOpen(true)}
            >
              <Plus size={18} />
              Add Rider
            </button>
          </div>

          <div className="flex gap-6 flex-1 min-h-0">
            <div className="w-[60%] flex flex-col h-full">
              <DeliveryOrdersList 
                deliveries={deliveries} 
                riders={riders} 
                onUpdate={() => { mutateDeliveries(); mutateRiders(); }} 
                isLoading={isDeliveriesLoading} 
              />
            </div>
            <div className="w-[40%] flex flex-col h-full">
              <RidersList 
                riders={riders} 
                isLoading={isRidersLoading} 
              />
            </div>
          </div>

        </div>
      </div>

      {isAddModalOpen && (
        <AddRiderModal
          branchId={branchId || ''}
          onClose={() => setIsAddModalOpen(false)} 
          onSuccess={() => { setIsAddModalOpen(false); mutateRiders(); }} 
        />
      )}
    </div>
  );
}
