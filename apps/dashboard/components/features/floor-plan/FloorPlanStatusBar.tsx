'use client';

import React from 'react';
import { useFloorPlanStore } from '../../../store/useFloorPlanStore';

const STATUS_COLORS: Record<string, string> = {
  available: 'bg-emerald-500',
  occupied: 'bg-red-500',
  reserved: 'bg-blue-500',
  dirty: 'bg-yellow-400',
};

export function FloorPlanStatusBar() {
  const { panX, panY, zoom, selectedTableId, tables, isDirty, activeFloor, gridSnap, showGrid } = useFloorPlanStore();
  
  const selectedTable = tables.find(t => t.id === selectedTableId);
  const objectLabel = selectedTable 
    ? `${selectedTable.label} (${selectedTable.shape}, cap: ${selectedTable.capacity})`
    : 'None selected';

  const floorTables = tables.filter(t => t.floor === activeFloor);
  const counts = {
    available: floorTables.filter(t => t.status === 'available').length,
    occupied:  floorTables.filter(t => t.status === 'occupied').length,
    reserved:  floorTables.filter(t => t.status === 'reserved').length,
    dirty:     floorTables.filter(t => t.status === 'dirty').length,
  };

  return (
    <div className="absolute bottom-0 left-[80px] right-0 h-8 bg-[#1A1A2E] text-[#94A3B8] flex items-center justify-between px-4 z-20 pointer-events-none select-none text-[12px] font-mono">
      {/* Left: pan/zoom/selection info */}
      <div className="flex items-center gap-3">
        <span>PAN {Math.round(panX)},{Math.round(panY)}</span>
        <span className="w-px h-3 bg-slate-700"></span>
        <span>ZOOM {Math.round(zoom * 100)}%</span>
        <span className="w-px h-3 bg-slate-700"></span>
        <span className="hidden sm:inline">SEL: {objectLabel}</span>
        <span className="w-px h-3 bg-slate-700"></span>
        <span className={gridSnap ? 'text-emerald-500' : 'text-slate-500'}>
          SNAP {gridSnap ? 'ON' : 'OFF'}
        </span>
        <span className="w-px h-3 bg-slate-700"></span>
        <span className={showGrid ? 'text-sky-400' : 'text-slate-500'}>
          GRID {showGrid ? 'ON' : 'OFF'}
        </span>
      </div>
      
      {/* Right: table legend */}
      <div className="flex items-center gap-3">
        {(Object.keys(counts) as Array<keyof typeof counts>).map(status => (
          <span key={status} className="flex items-center gap-1 text-[#94A3B8]">
            <span className={`inline-block w-2 h-2 rounded-full ${STATUS_COLORS[status]}`}></span>
            {counts[status]} {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        ))}
        <span className="ml-2 flex items-center gap-1">
          <span className="relative flex h-1.5 w-1.5">
            {isDirty ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-yellow-500"></span>
              </>
            ) : (
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            )}
          </span>
          <span className="text-[#94A3B8]">{isDirty ? 'Unsaved' : 'Saved'}</span>
        </span>
      </div>
    </div>
  );
}
