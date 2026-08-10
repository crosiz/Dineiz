'use client';

import React, { useRef, useCallback } from 'react';
import {
  DndContext,
  useDraggable,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragMoveEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import { useFloorPlanStore } from '../../../store/useFloorPlanStore';
import { floorPlanApi, TableElement } from '../../../lib/api/floor-plan';
import { TablePropertiesPanel } from './TablePropertiesPanel';
import { PremiumTable } from './elements/PremiumTable';
import { toast } from 'sonner';

interface FloorPlanCanvasProps {
  disabled?: boolean;
}

interface VerticalGuide {
  x: number;
  startY: number;
  endY: number;
}

interface HorizontalGuide {
  y: number;
  startX: number;
  endX: number;
}

interface AlignmentCheckResult {
  snappedX: number;
  snappedY: number;
  vGuide: VerticalGuide | null;
  hGuide: HorizontalGuide | null;
}

function checkAlignment(
  draggingTable: TableElement,
  deltaX: number,
  deltaY: number,
  otherTables: TableElement[],
  threshold = 6
): AlignmentCheckResult {
  const currentX = draggingTable.x + deltaX;
  const currentY = draggingTable.y + deltaY;

  const w = draggingTable.width;
  const h = draggingTable.height;

  let snappedX = currentX;
  let snappedY = currentY;

  let vGuide: VerticalGuide | null = null;
  let hGuide: HorizontalGuide | null = null;

  const dragLeft = currentX;
  const dragCenterX = currentX + w / 2;
  const dragRight = currentX + w;

  const dragTop = currentY;
  const dragCenterY = currentY + h / 2;
  const dragBottom = currentY + h;

  for (const other of otherTables) {
    const oLeft = other.x;
    const oCenterX = other.x + other.width / 2;
    const oRight = other.x + other.width;

    const oTop = other.y;
    const oCenterY = other.y + other.height / 2;
    const oBottom = other.y + other.height;

    // Vertical Alignment Checks (X-axis)
    let vAlignX: number | null = null;

    if (Math.abs(dragLeft - oLeft) <= threshold) {
      snappedX = oLeft;
      vAlignX = oLeft;
    } else if (Math.abs(dragLeft - oRight) <= threshold) {
      snappedX = oRight;
      vAlignX = oRight;
    } else if (Math.abs(dragCenterX - oCenterX) <= threshold) {
      snappedX = oCenterX - w / 2;
      vAlignX = oCenterX;
    } else if (Math.abs(dragRight - oLeft) <= threshold) {
      snappedX = oLeft - w;
      vAlignX = oLeft;
    } else if (Math.abs(dragRight - oRight) <= threshold) {
      snappedX = oRight - w;
      vAlignX = oRight;
    }

    if (vAlignX !== null) {
      const minY = Math.min(currentY, other.y) - 8;
      const maxY = Math.max(currentY + h, other.y + other.height) + 8;
      vGuide = { x: vAlignX, startY: minY, endY: maxY };
    }

    // Horizontal Alignment Checks (Y-axis)
    let hAlignY: number | null = null;

    if (Math.abs(dragTop - oTop) <= threshold) {
      snappedY = oTop;
      hAlignY = oTop;
    } else if (Math.abs(dragTop - oBottom) <= threshold) {
      snappedY = oBottom;
      hAlignY = oBottom;
    } else if (Math.abs(dragCenterY - oCenterY) <= threshold) {
      snappedY = oCenterY - h / 2;
      hAlignY = oCenterY;
    } else if (Math.abs(dragBottom - oTop) <= threshold) {
      snappedY = oTop - h;
      hAlignY = oTop;
    } else if (Math.abs(dragBottom - oBottom) <= threshold) {
      snappedY = oBottom - h;
      hAlignY = oBottom;
    }

    if (hAlignY !== null) {
      const minX = Math.min(currentX, other.x) - 8;
      const maxX = Math.max(currentX + w, other.x + other.width) + 8;
      hGuide = { y: hAlignY, startX: minX, endX: maxX };
    }
  }

  return {
    snappedX,
    snappedY,
    vGuide,
    hGuide,
  };
}

const DraggableTableWrapper = React.memo(function DraggableTableWrapper({
  table,
  isSelected,
  onClick,
}: {
  table: TableElement;
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: table.id,
  });

  const currentX = table.x + (transform ? transform.x : 0);
  const currentY = table.y + (transform ? transform.y : 0);

  const clampedX = Math.max(0, Math.min(1200 - table.width, currentX));
  const clampedY = Math.max(0, Math.min(700 - table.height, currentY));

  const clampedWrapperX = clampedX - 20;
  const clampedWrapperY = clampedY - 20;

  return (
    <div
      ref={setNodeRef}
      style={{
        position: 'absolute',
        left: `${clampedWrapperX}px`,
        top: `${clampedWrapperY}px`,
        touchAction: 'none',
        zIndex: isDragging ? 40 : isSelected ? 30 : 10,
        transform: 'translate3d(0, 0, 0)',
        willChange: isDragging ? 'left, top' : 'auto',
      }}
    >
      <PremiumTable
        label={table.label}
        capacity={table.capacity}
        shape={table.shape}
        status={table.status || 'FREE'}
        occupiedSince={table.occupiedSince}
        isSelected={isSelected}
        onClick={onClick}
        dragHandleProps={{ ...listeners, ...attributes }}
      />
    </div>
  );
});

export function FloorPlanCanvas({ disabled }: FloorPlanCanvasProps) {
  const {
    tables,
    activeFloor,
    selectedTableId,
    selectTable,
    updateTable,
    pushUndoState,
    showGrid,
  } = useFloorPlanStore();

  const vGuideRef = useRef<HTMLDivElement>(null);
  const hGuideRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  // Filter tables by active floor
  const floorTables = tables.filter((t) => (t.floor || 1) === activeFloor && t.isActive !== false);
  const selectedTable = floorTables.find((t) => t.id === selectedTableId) || null;

  const hideGuides = useCallback(() => {
    if (vGuideRef.current) vGuideRef.current.style.display = 'none';
    if (hGuideRef.current) hGuideRef.current.style.display = 'none';
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    hideGuides();
  }, [hideGuides]);

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    if (!showGrid) {
      hideGuides();
      return;
    }

    const { active, delta } = event;
    const tableId = active.id as string;
    const draggingTable = floorTables.find((t) => t.id === tableId);
    if (!draggingTable) return;

    const otherTables = floorTables.filter((t) => t.id !== tableId);
    const alignResult = checkAlignment(draggingTable, delta.x, delta.y, otherTables, 6);

    // Direct DOM manipulation for guidelines — ZERO React re-renders while dragging
    if (alignResult.vGuide && vGuideRef.current) {
      vGuideRef.current.style.display = 'block';
      vGuideRef.current.style.left = `${alignResult.vGuide.x}px`;
      vGuideRef.current.style.top = `${alignResult.vGuide.startY}px`;
      vGuideRef.current.style.height = `${alignResult.vGuide.endY - alignResult.vGuide.startY}px`;
    } else if (vGuideRef.current) {
      vGuideRef.current.style.display = 'none';
    }

    if (alignResult.hGuide && hGuideRef.current) {
      hGuideRef.current.style.display = 'block';
      hGuideRef.current.style.top = `${alignResult.hGuide.y}px`;
      hGuideRef.current.style.left = `${alignResult.hGuide.startX}px`;
      hGuideRef.current.style.width = `${alignResult.hGuide.endX - alignResult.hGuide.startX}px`;
    } else if (hGuideRef.current) {
      hGuideRef.current.style.display = 'none';
    }
  }, [floorTables, showGrid, hideGuides]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, delta } = event;
    hideGuides();

    if (!delta.x && !delta.y) return;

    const tableId = active.id as string;
    const table = tables.find((t) => t.id === tableId);
    if (!table) return;

    const otherTables = floorTables.filter((t) => t.id !== tableId);
    const alignResult = showGrid
      ? checkAlignment(table, delta.x, delta.y, otherTables, 6)
      : { snappedX: table.x + delta.x, snappedY: table.y + delta.y, vGuide: null, hGuide: null };

    // Soft drop snap to alignment or current dropped position
    const finalX = alignResult.snappedX;
    const finalY = alignResult.snappedY;

    // Clamp coordinates to keep table strictly inside 1200x700 container
    const clampedX = Math.max(0, Math.min(1200 - table.width, Math.round(finalX)));
    const clampedY = Math.max(0, Math.min(700 - table.height, Math.round(finalY)));

    pushUndoState();
    updateTable(tableId, { x: clampedX, y: clampedY });

    // Auto-save position to backend
    try {
      await floorPlanApi.putTable(tableId, {
        positionX: clampedX,
        positionY: clampedY,
      });
    } catch (err: any) {
      console.error('Failed to auto-save table position:', err);
      toast.error('Failed to auto-save table position');
    }
  }, [tables, floorTables, pushUndoState, updateTable, hideGuides, showGrid]);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      selectTable(null);
    }
  };

  return (
    <div className="flex-1 bg-slate-100 flex items-center justify-center p-8 overflow-auto select-none">
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
      >
        {/* Fixed 1200x700px container */}
        <div
          onClick={handleCanvasClick}
          style={{
            width: '1200px',
            height: '700px',
            position: 'relative',
            overflow: 'hidden',
          }}
          className={`bg-white rounded-2xl shadow-xl border border-slate-200 relative transition-all ${
            showGrid ? 'bg-[radial-gradient(#cbd5e1_1.2px,transparent_1.2px)] [background-size:20px_20px]' : ''
          }`}
        >
          {/* Direct DOM Vertical Guideline Element */}
          <div
            ref={vGuideRef}
            style={{
              position: 'absolute',
              display: 'none',
              width: '1.5px',
              backgroundColor: '#F43F5E',
              opacity: 0.9,
              zIndex: 45,
              pointerEvents: 'none',
            }}
          />

          {/* Direct DOM Horizontal Guideline Element */}
          <div
            ref={hGuideRef}
            style={{
              position: 'absolute',
              display: 'none',
              height: '1.5px',
              backgroundColor: '#F43F5E',
              opacity: 0.9,
              zIndex: 45,
              pointerEvents: 'none',
            }}
          />

          {/* Tables */}
          {floorTables.map((table) => (
            <DraggableTableWrapper
              key={table.id}
              table={table}
              isSelected={table.id === selectedTableId}
              onClick={(e) => {
                e.stopPropagation();
                selectTable(table.id);
              }}
            />
          ))}

          {/* Floating Properties Panel positioned directly above selected table */}
          {selectedTable && <TablePropertiesPanel table={selectedTable} />}

          {/* Empty state overlay */}
          {floorTables.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-400">
              <p className="text-base font-bold text-slate-500">Floor {activeFloor} is empty</p>
              <p className="text-xs text-slate-400">Click "+ Add Table" on the toolbar to place your first table.</p>
            </div>
          )}
        </div>
      </DndContext>
    </div>
  );
}
