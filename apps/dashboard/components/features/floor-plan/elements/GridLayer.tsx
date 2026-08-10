'use client';

import React from 'react';
import { Layer, Shape } from 'react-konva';
import { useFloorPlanStore } from '../../../../store/useFloorPlanStore';

interface GridLayerProps {
  width: number;
  height: number;
}

const GRID_SIZE = 24; // base logical grid size in canvas units

export function GridLayer({ width, height }: GridLayerProps) {
  const { showGrid, panX, panY, zoom } = useFloorPlanStore();

  if (!showGrid) return null;

  return (
    <Layer listening={false}>
      <Shape
        width={width}
        height={height}
        sceneFunc={(context) => {
          context.beginPath();

          // The grid in screen space:
          // a canvas point (gx, gy) maps to screen: screenX = gx * zoom + panX
          // We want grid points at multiples of GRID_SIZE in canvas coords.
          const scaledGrid = GRID_SIZE * zoom;

          // Starting canvas coord (in canvas units) of the first dot on screen
          const firstCanvasX = -panX / zoom;
          const firstCanvasY = -panY / zoom;

          const startCanvasX = Math.floor(firstCanvasX / GRID_SIZE) * GRID_SIZE;
          const startCanvasY = Math.floor(firstCanvasY / GRID_SIZE) * GRID_SIZE;

          const endCanvasX = firstCanvasX + width / zoom;
          const endCanvasY = firstCanvasY + height / zoom;

          for (let gx = startCanvasX; gx <= endCanvasX; gx += GRID_SIZE) {
            for (let gy = startCanvasY; gy <= endCanvasY; gy += GRID_SIZE) {
              const sx = gx * zoom + panX;
              const sy = gy * zoom + panY;
              context.moveTo(sx + 1, sy);
              context.arc(sx, sy, Math.max(0.8, zoom * 0.8), 0, Math.PI * 2, false);
            }
          }

          context.fillStyle = zoom > 0.5 ? '#cbd5e1' : '#e2e8f0';
          context.fill();
        }}
        hitFunc={() => {}}
      />
    </Layer>
  );
}
