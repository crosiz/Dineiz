'use client';

import React from 'react';
import { Group, Rect, Text, Label, Tag } from 'react-konva';
import { useFloorPlanStore } from '../../../../store/useFloorPlanStore';
import { ZoneElement as ZoneElementType } from '../../../../lib/api/floor-plan';

interface ZoneElementProps {
  zone: ZoneElementType;
}

export function ZoneElement({ zone }: ZoneElementProps) {
  const { activeTool, deleteZone } = useFloorPlanStore();

  return (
    <Group
      x={zone.startX}
      y={zone.startY}
      onClick={() => {
        if (activeTool === 'zone') {
          deleteZone(zone.id);
        }
      }}
    >
      <Rect
        width={zone.endX - zone.startX}
        height={zone.endY - zone.startY}
        fill="rgba(59,130,246,0.06)"
        stroke="#3B82F6"
        strokeWidth={1.5}
        dash={[10, 5]}
        cornerRadius={0}
      />
      <Label x={0} y={0}>
        <Tag fill="#3B82F6" cornerRadius={10} pointerDirection="none" pointerWidth={0} pointerHeight={0} lineJoin="round" />
        <Text text={zone.name} fontSize={10} fill="white" padding={6} fontStyle="bold" />
      </Label>
    </Group>
  );
}
