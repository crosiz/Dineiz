'use client';

import React from 'react';
import { Line, Group } from 'react-konva';
import { useFloorPlanStore } from '../../../../store/useFloorPlanStore';
import { WallElement as WallElementType } from '../../../../lib/api/floor-plan';

interface WallElementProps {
  wall: WallElementType;
}

export function WallElement({ wall }: WallElementProps) {
  const { activeTool, deleteWall } = useFloorPlanStore();

  let stroke = '#94a3b8';
  let strokeWidth = 8;
  let dash = undefined;

  if (wall.type === 'exterior') {
    stroke = '#334155';
    strokeWidth = 12;
  } else if (wall.type === 'glass') {
    stroke = '#7dd3fc';
    strokeWidth = 6;
  } else if (wall.type === 'partition') {
    stroke = '#cbd5e1';
    strokeWidth = 4;
    dash = [10, 5];
  }

  return (
    <Group
      onClick={() => {
        if (activeTool === 'wall') {
          // Double click or something to delete? 
          // Let's just do a simple delete on click if wall tool is active for now, or add a delete tool.
          // Since we don't have delete tool, if we click with activeTool='select', we could select it, but we lack time.
          // Let's just let them be static for now or delete on click if wall tool.
          deleteWall(wall.id);
        }
      }}
    >
      <Line
        points={[wall.startX, wall.startY, wall.endX, wall.endY]}
        stroke={stroke}
        strokeWidth={strokeWidth}
        lineCap="round"
        dash={dash}
      />
    </Group>
  );
}
