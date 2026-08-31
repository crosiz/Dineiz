'use client';

import React, { useEffect } from 'react';
import { FloorPlanTopBar } from './FloorPlanTopBar';
import { FloorPlanToolbar } from './FloorPlanToolbar';
import { FloorPlanCanvas } from './FloorPlanCanvas';
import { useFloorPlanStore } from '../../../store/useFloorPlanStore';
import { useQuery } from '@tanstack/react-query';
import { floorPlanApi } from '../../../lib/api/floor-plan';
import { authClient } from '../../../lib/auth-client';
import { useFloorPlanSocket } from './hooks/useFloorPlanSocket';
import { useDashboardContext } from '@/contexts/dashboard-context';
import { Store } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

// Mirrors the editor chrome — top bar, tool rail, canvas — so the real editor
// drops straight in without the frame jumping.
function EditorSkeleton({ label }: { label: string }) {
  return (
    <div
      className="h-[calc(100vh-4rem)] w-full flex flex-col bg-white overflow-hidden"
      role="status"
      aria-busy="true"
    >
      <span className="sr-only">{label}</span>
      <div className="h-14 border-b border-slate-200 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
      <div className="flex-1 flex min-h-0">
        <div className="w-14 border-r border-slate-200 flex flex-col items-center gap-3 py-4 shrink-0">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-9 rounded-lg" />
          ))}
        </div>
        <div className="flex-1 p-8 bg-slate-50">
          <Skeleton className="h-full w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function FloorPlanEditor() {
  const {
    setTables,
    showTableStatus,
    selectedBranchId,
    setSelectedBranchId,
    markClean,
  } = useFloorPlanStore();

  const { selectedBranchId: globalBranchId } = useDashboardContext();

  const { data: session } = authClient.useSession();
  const user = session?.user;
  const isTenantAdmin = user?.role === 'TENANT_ADMIN' || user?.role === 'SUPER_ADMIN';

  // Sync global branch selector context to store selectedBranchId
  useEffect(() => {
    if (globalBranchId !== undefined && globalBranchId !== null) {
      if (globalBranchId !== selectedBranchId) {
        useFloorPlanStore.getState().clearCanvas();
        setSelectedBranchId(globalBranchId);
      }
    }
  }, [globalBranchId, selectedBranchId, setSelectedBranchId]);

  useEffect(() => {
    if (user && !selectedBranchId) {
      if (!isTenantAdmin && user.branchId) {
        setSelectedBranchId(user.branchId);
      }
    }
  }, [user, selectedBranchId, setSelectedBranchId, isTenantAdmin]);

  // Fetch initial floor plan and tables
  const { data: floorPlanData, isLoading } = useQuery({
    queryKey: ['floorPlan', selectedBranchId],
    queryFn: () => floorPlanApi.getFloorPlan(selectedBranchId),
    enabled: !!selectedBranchId,
  });

  useEffect(() => {
    if (floorPlanData) {
      const apiTables =
        floorPlanData.tables?.map((t: any) => ({
          id: t.id,
          label: t.label,
          capacity: t.capacity,
          shape: t.shape,
          x: t.positionX ?? 100,
          y: t.positionY ?? 100,
          width: t.width || 90,
          height: t.height || 90,
          rotation: t.rotation || 0,
          floor: t.floorNumber || 1,
          allowReservations: t.allowReservations ?? true,
          joinable: t.joinable ?? false,
          isActive: t.isActive,
          // The API already computes real status from active orders
          // (floor-plan.routes.ts) — this used to be discarded and
          // hardcoded to 'available' on every load.
          status: t.status ?? 'FREE',
          occupiedSince: t.occupiedSince ?? undefined,
          activeOrderId: t.activeOrderId ?? undefined,
        })) || [];

      setTables(apiTables);

      // Extract floor numbers from tables if available
      const existingFloors = Array.from(
        new Set(apiTables.map((t: any) => t.floor || 1))
      ) as number[];
      if (existingFloors.length > 0) {
        useFloorPlanStore.setState({
          floors: Array.from(new Set([1, ...existingFloors])).sort((a, b) => a - b),
        });
      }

      markClean();
    }
  }, [floorPlanData, setTables, markClean]);

  // Use Socket.IO for real-time table statuses
  useFloorPlanSocket(selectedBranchId, showTableStatus);

  if (!selectedBranchId && !user) {
    return <EditorSkeleton label="Authenticating" />;
  }

  if (isLoading && !!selectedBranchId) {
    return <EditorSkeleton label="Loading floor plan editor" />;
  }

  const hasBranch = !!selectedBranchId;

  return (
    <div className="h-[calc(100vh-4rem)] w-full flex flex-col bg-white overflow-hidden relative font-sans text-slate-900">
      <FloorPlanTopBar />

      <div className="flex-1 flex overflow-hidden relative">
        <FloorPlanToolbar disabled={!hasBranch} />

        <div className="relative flex-1 flex flex-col overflow-hidden bg-slate-100">
          {!hasBranch && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/90 backdrop-blur-xs">
              <div className="text-center p-8 max-w-sm">
                <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Store className="w-8 h-8 text-amber-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Select a branch first</h3>
                <p className="text-sm text-slate-500 mb-6">
                  Choose a branch from the global dropdown above to start editing its floor plan.
                </p>
              </div>
            </div>
          )}

          <FloorPlanCanvas disabled={!hasBranch} />
        </div>
      </div>
    </div>
  );
}
