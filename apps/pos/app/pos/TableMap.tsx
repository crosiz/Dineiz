'use client';

import { useState, useEffect } from 'react';
import { ReactFlow, Background, Node, useNodesState } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ShapeComponents } from '@swiftserve/ui';
import { useCartStore } from '@/lib/store';
import { toast } from 'sonner';
import { useSocket } from '@/contexts/SocketContext';
import { getToken } from '@/lib/pos-session';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const TABLE_VISUAL: Record<string, any> = {
  free: {
    fill: '#0D3320',           // clearly visible dark green
    stroke: '#10B981',          // bright green border
    glow: '0 0 0 3px rgba(16,185,129,0.3), 0 0 20px rgba(16,185,129,0.15)',
  },
  occupied: {
    fill: '#330D0D',           // clearly visible dark red
    stroke: '#EF4444',
    glow: '0 0 0 3px rgba(239,68,68,0.3), 0 0 20px rgba(239,68,68,0.15)',
  },
  bill_requested: {
    fill: '#0D1A33',           // clearly visible dark blue
    stroke: '#3B82F6',
    glow: '0 0 0 3px rgba(59,130,246,0.3), 0 0 20px rgba(59,130,246,0.15)',
  },
  reserved: {
    fill: '#1A0D33',           // clearly visible dark purple
    stroke: '#8B5CF6',
    glow: '0 0 0 3px rgba(139,92,246,0.3)',
  },
  dirty: {
    fill: '#33250D',           // clearly visible dark yellow
    stroke: '#F59E0B',
    glow: '0 0 0 3px rgba(245,158,11,0.3)',
  },
}

function POSTableNode({ data: table }: { data: any }) {
  const isTable = table.type.startsWith('table_') || table.capacity;
  
  if (!isTable) {
    const Shape = (ShapeComponents[table.type] || ShapeComponents.table_round) as any;
    return (
      <div style={{ width: table.width, height: table.height, transform: `rotate(${table.rotation || 0}deg)` }}>
        <Shape width={table.width} height={table.height} label={table.label} color={table.color || '#d1d5db'} />
      </div>
    );
  }

  const tableStatus = table.status || 'free';
  const visual = TABLE_VISUAL[tableStatus] ?? TABLE_VISUAL.free;
  const occupiedSince = table.since;

  const getElapsedLabel = (since: string) => {
    const mins = Math.floor((Date.now() - new Date(since).getTime()) / 60000);
    return `${mins} min elapsed`;
  };

  return (
    <div
      onClick={() => table.onTableClick(table, tableStatus)}
      style={{
        width: `${table.width || 90}px`,
        height: `${table.height || 90}px`,
        borderRadius: '14px',
        backgroundColor: visual.fill,
        border: `2.5px solid ${visual.stroke}`,
        boxShadow: visual.glow,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'transform 0.1s ease',
        userSelect: 'none',
      }}
      onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.94)')}
      onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
      onTouchStart={e => (e.currentTarget.style.transform = 'scale(0.94)')}
      onTouchEnd={e => (e.currentTarget.style.transform = 'scale(1)')}
    >
      {/* Status dot top right */}
      <div style={{
        position: 'absolute', top: '6px', right: '6px',
        width: '8px', height: '8px', borderRadius: '50%',
        backgroundColor: visual.stroke,
      }} />

      {/* Table label */}
      <span style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: 700 }}>
        {table.label}
      </span>

      {/* Seat count */}
      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', marginTop: '2px' }}>
        {table.capacity} seats
      </span>

      {/* Elapsed time for occupied */}
      {tableStatus === 'occupied' && occupiedSince && (
        <span style={{ color: '#EF4444', fontSize: '10px', fontWeight: 700, marginTop: '2px' }}>
          {getElapsedLabel(occupiedSince)}
        </span>
      )}
    </div>
  );
}

const nodeTypes = {
  shape: POSTableNode,
};

export default function TableMap({ onTableSelect, viewOnly = false }: { onTableSelect: (table: any) => void, viewOnly?: boolean }) {
  const session = useCartStore((s) => s.session);
  const branchId = session.branchId || localStorage.getItem('branchId'); // Fallback if session branchId not set yet
  const { socket, isConnected } = useSocket();
  
  const [floors, setFloors] = useState<any[]>([]);
  const [activeFloorNumber, setActiveFloorNumber] = useState(1);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMap = async () => {
      if (!branchId) return;
      setIsLoading(true);
      try {
        const [mapRes, statusRes] = await Promise.all([
          fetch(`${API_URL}/api/floor-plan/map?branchId=${branchId}`, { credentials: 'include' }),
          fetch(`${API_URL}/api/floor-plan/status?branchId=${branchId}`, { credentials: 'include' })
        ]);
        
        if (mapRes.ok && statusRes.ok) {
          const mapData = await mapRes.json();
          const statuses = await statusRes.json();
          
          const statusMap = new Map<string, any>(statuses.map((s: any) => [s.tableId, s]));
          
          const enhancedFloors = mapData.floors.map((f: any) => ({
            ...f,
            items: f.items.map((i: any) => {
              const s = statusMap.get(i.tableId);
              return {
                ...i,
                status: s?.status || i.status || 'free',
                since: s?.since,
                orderId: s?.orderId,
                onTableClick: onTableSelect
              };
            })
          }));
          
          setFloors(enhancedFloors);
          if (enhancedFloors.length > 0) setActiveFloorNumber(enhancedFloors[0].floorNumber);
        }
      } catch (err) {
        toast.error('Failed to load table map');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMap();
  }, [branchId, onTableSelect]);

  useEffect(() => {
    if (!socket || !isConnected || !branchId) return;

    socket.emit('join_branch', branchId);

    const handleTableStatus = (data: any) => {
      setFloors(prev => prev.map(f => ({
        ...f,
        items: f.items.map((i: any) => 
          i.tableId === data.tableId 
            ? { ...i, status: data.status, since: data.since, orderId: data.orderId }
            : i
        )
      })));
    };

    socket.on('table:status_changed', handleTableStatus);

    return () => {
      socket.off('table:status_changed', handleTableStatus);
    };
  }, [socket, isConnected, branchId]);

  useEffect(() => {
    const activeFloor = floors.find(f => f.floorNumber === activeFloorNumber);
    if (activeFloor) {
      setNodes(
        activeFloor.items.map((item: any) => ({
          id: item.id,
          type: 'shape',
          position: { x: item.x, y: item.y },
          data: { ...item },
          draggable: false,
          selectable: false,
        }))
      );
    }
  }, [activeFloorNumber, floors, setNodes]);

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center text-slate-400">Loading Floor Plan...</div>;
  }

  if (floors.length === 0) {
    return <div className="flex-1 flex items-center justify-center text-slate-400">No floor plan configured for this branch.</div>;
  }

  const activeFloor = floors.find(f => f.floorNumber === activeFloorNumber);

  return (
    <div 
      className="flex-1 flex flex-col h-full bg-[var(--pos-bg-raised)] relative overflow-hidden"
      style={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#0F1623',
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }}
    >
      {/* Restaurant boundary */}
      <div
        className="absolute rounded-xl pointer-events-none"
        style={{
          top: '5%', left: '3%', right: '3%', bottom: '5%',
          backgroundColor: '#161D2E',
          border: '1.5px dashed rgba(255,255,255,0.08)',
          zIndex: 0
        }}
      />
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        {floors.map(f => (
          <button
            key={f.floorNumber}
            onClick={() => setActiveFloorNumber(f.floorNumber)}
            className={`px-4 py-2 rounded-md font-bold text-sm shadow-sm transition-colors ${
              activeFloorNumber === f.floorNumber ? 'bg-[#3B82F6] text-white' : 'bg-[var(--pos-bg-elevated)] text-slate-300 hover:bg-slate-800 border border-slate-700'
            }`}
          >
            {f.floorName}
          </button>
        ))}
      </div>
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-10 flex gap-4 bg-[var(--pos-bg-elevated)]/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-sm border border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#10B981]"></div>
          <span className="text-xs font-semibold text-slate-200">Free</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#EF4444]"></div>
          <span className="text-xs font-semibold text-slate-200">Occupied</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#3B82F6]"></div>
          <span className="text-xs font-semibold text-slate-200">Order Ready</span>
        </div>
      </div>

      <ReactFlow
        nodes={nodes}
        nodeTypes={nodeTypes}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        minZoom={0.2}
        maxZoom={3}
        style={{ backgroundColor: activeFloor?.backgroundColor || 'transparent', zIndex: 1 }}
      >
        <Background color="rgba(255,255,255,0.05)" gap={20} />
      </ReactFlow>
    </div>
  );
}
