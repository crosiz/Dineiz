'use client';

import React, { useRef, useEffect } from 'react';
import { Group, Image as KonvaImage, Transformer } from 'react-konva';
import { useFloorPlanStore } from '../../../../store/useFloorPlanStore';
import { DecorElement as DecorElementType } from '../../../../lib/api/floor-plan';
import Konva from 'konva';
import { getDecorIcon } from '../utils/decorIcons';
import { renderToStaticMarkup } from 'react-dom/server';
import useImage from 'use-image';

interface DecorElementProps {
  decor: DecorElementType;
}

export function DecorElement({ decor }: DecorElementProps) {
  const { 
    activeTool, 
    updateDecor,
    deleteDecor,
    gridSnap
  } = useFloorPlanStore();
  
  const [isSelected, setIsSelected] = React.useState(false);
  const groupRef = useRef<Konva.Group>(null);
  const trRef = useRef<Konva.Transformer>(null);

  // Convert Lucide Icon to SVG Data URL
  const svgUrl = React.useMemo(() => {
    const IconComponent = getDecorIcon(decor.emoji);
    const size = Math.min(decor.width, decor.height);
    const svgString = renderToStaticMarkup(<IconComponent size={size} color="#64748b" strokeWidth={1.5} />);
    return `data:image/svg+xml,${encodeURIComponent(svgString)}`;
  }, [decor.emoji, decor.width, decor.height]);

  const [image] = useImage(svgUrl);

  useEffect(() => {
    if (isSelected && trRef.current && groupRef.current) {
      trRef.current.nodes([groupRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  const handleDragEnd = (e: any) => {
    let newX = e.target.x();
    let newY = e.target.y();

    if (gridSnap) {
      newX = Math.round(newX / 24) * 24;
      newY = Math.round(newY / 24) * 24;
      e.target.position({ x: newX, y: newY });
      e.target.getLayer()?.batchDraw();
    }

    updateDecor(decor.id, { x: newX, y: newY });
  };

  const handleTransformEnd = (e: any) => {
    const node = groupRef.current;
    if (!node) return;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);

    updateDecor(decor.id, {
      x: node.x(),
      y: node.y(),
      rotation: node.rotation(),
      width: Math.max(20, node.width() * scaleX),
      height: Math.max(20, node.height() * scaleY),
    });
  };

  // Deselect on outside click is handled by stage in FloorPlanCanvas

  return (
    <>
      <Group
        ref={groupRef}
        x={decor.x}
        y={decor.y}
        width={decor.width}
        height={decor.height}
        rotation={decor.rotation}
        draggable={activeTool === 'select'}
        onClick={() => {
          if (activeTool === 'select') {
            setIsSelected(true);
          } else if (activeTool === 'decor') {
            deleteDecor(decor.id);
          }
        }}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
      >
        <KonvaImage
          image={image}
          width={decor.width}
          height={decor.height}
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
          rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
        />
      )}
    </>
  );
}
