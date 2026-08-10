'use client';

import React, { useRef, useEffect } from 'react';
import { Group, Rect, Circle, Text, Transformer } from 'react-konva';
import { useFloorPlanStore } from '../../../../store/useFloorPlanStore';
import { TableElement as TableElementType } from '../../../../lib/api/floor-plan';
import Konva from 'konva';

interface TableElementProps {
  table: TableElementType;
}

export function TableElement({ table }: TableElementProps) {
  const { 
    selectedTableId, 
    selectTable, 
    updateTable, 
    gridSnap,
    pushUndoState,
    activeTool
  } = useFloorPlanStore();
  
  const isSelected = selectedTableId === table.id;
  const groupRef = useRef<Konva.Group>(null);
  const trRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    if (isSelected && trRef.current && groupRef.current) {
      trRef.current.nodes([groupRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  const handleDragStart = () => {
    if (activeTool !== 'select') return;
    pushUndoState();
    selectTable(table.id);
  };

  const handleDragEnd = (e: any) => {
    let newX = e.target.x();
    let newY = e.target.y();

    if (gridSnap) {
      newX = Math.round(newX / 24) * 24;
      newY = Math.round(newY / 24) * 24;
      e.target.position({ x: newX, y: newY });
      e.target.getLayer()?.batchDraw();
    }

    updateTable(table.id, { x: newX, y: newY });
  };

  const handleDragMove = (e: any) => {
    // Just handle it to suppress Konva warning
  };

  const handleTransformEnd = (e: any) => {
    const node = groupRef.current;
    if (!node) return;

    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    
    // reset scale
    node.scaleX(1);
    node.scaleY(1);

    updateTable(table.id, {
      x: node.x(),
      y: node.y(),
      rotation: node.rotation(),
      width: Math.max(20, node.width() * scaleX),
      height: Math.max(20, node.height() * scaleY),
    });
  };

  const getStatusColors = () => {
    switch (table.status) {
      case 'occupied': return { fill: '#fff7ed', stroke: '#f97316', dot: '#f97316' };
      case 'reserved': return { fill: '#eff6ff', stroke: '#3b82f6', dot: '#3b82f6' };
      case 'dirty': return { fill: '#fef9c3', stroke: '#eab308', dot: '#eab308' };
      case 'available':
      default: return { fill: 'white', stroke: '#e2e8f0', dot: '#22c55e' };
    }
  };

  const colors = getStatusColors();

  const isCircle = table.shape === 'round';

  return (
    <>
      <Group
        id={table.id}
        ref={groupRef}
        x={table.x}
        y={table.y}
        width={table.width}
        height={table.height}
        rotation={table.rotation}
        draggable={activeTool === 'select'}
        onMouseDown={(e) => {
          if (activeTool === 'select') selectTable(table.id);
        }}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
      >
        {isCircle ? (
          <Circle
            x={table.width / 2}
            y={table.height / 2}
            radius={Math.min(table.width, table.height) / 2}
            fill={colors.fill}
            stroke={isSelected ? '#ff5722' : colors.stroke}
            strokeWidth={isSelected ? 3 : 2}
            dash={isSelected ? [8, 4] : undefined}
          />
        ) : (
          <Rect
            width={table.width}
            height={table.height}
            fill={colors.fill}
            stroke={isSelected ? '#ff5722' : colors.stroke}
            strokeWidth={isSelected ? 3 : 2}
            cornerRadius={table.shape === 'booth' ? 16 : 8}
            dash={isSelected ? [8, 4] : undefined}
          />
        )}
        
        <Text
          text={table.label}
          width={table.width}
          y={table.height / 2 - 14}
          align="center"
          fontStyle="bold"
          fontSize={14}
          fill="#334155"
        />
        <Text
          text={`${table.capacity} Seats`}
          width={table.width}
          y={table.height / 2 + 4}
          align="center"
          fontSize={11}
          fill="#64748b"
        />

        {/* Status Dot */}
        <Circle
          x={table.width + 6}
          y={-6}
          radius={4}
          fill={colors.dot}
        />
      </Group>
      
      {isSelected && activeTool === 'select' && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 20 || newBox.height < 20) {
              return oldBox;
            }
            return newBox;
          }}
          enabledAnchors={isCircle ? [] : ['top-left', 'top-right', 'bottom-left', 'bottom-right']}
          rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
        />
      )}
    </>
  );
}
