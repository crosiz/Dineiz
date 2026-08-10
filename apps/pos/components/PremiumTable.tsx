'use client';

import React, { useState, useEffect, useMemo } from 'react';

export type TableStatus =
  | 'FREE'
  | 'OCCUPIED'
  | 'BILL_REQUESTED'
  | 'RESERVED'
  | 'DIRTY'
  | 'free'
  | 'occupied'
  | 'bill_requested'
  | 'reserved'
  | 'dirty'
  | 'available'
  | 'ready'
  | 'billed';

export interface PremiumTableProps {
  label: string;
  capacity: number;
  shape?: 'square' | 'rectangle' | 'round' | 'long' | string;
  status?: TableStatus | string;
  occupiedSince?: string | number | Date;
  isSelected?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  style?: React.CSSProperties;
}

const STATUS_CONFIG: Record<
  string,
  {
    border: string;
    boxShadow: string;
    pulseBoxShadow: string;
    timerColor: string;
  }
> = {
  FREE: {
    border: '2px solid rgba(16,185,129,0.65)',
    boxShadow:
      '0 0 0 1px rgba(16,185,129,0.15), 0 0 14px rgba(16,185,129,0.12), inset 0 1px 0 rgba(255,255,255,0.6)',
    pulseBoxShadow: '',
    timerColor: 'rgba(16,185,129,0.95)',
  },
  OCCUPIED: {
    border: '2px solid rgba(239,68,68,0.75)',
    boxShadow:
      '0 0 0 1px rgba(239,68,68,0.2), 0 0 18px rgba(239,68,68,0.18), inset 0 1px 0 rgba(255,255,255,0.6)',
    pulseBoxShadow:
      '0 0 0 1px rgba(239,68,68,0.35), 0 0 24px rgba(239,68,68,0.22), inset 0 1px 0 rgba(255,255,255,0.6)',
    timerColor: 'rgba(239,68,68,0.95)',
  },
  BILL_REQUESTED: {
    border: '2px solid rgba(59,130,246,0.75)',
    boxShadow:
      '0 0 0 1px rgba(59,130,246,0.2), 0 0 16px rgba(59,130,246,0.15), inset 0 1px 0 rgba(255,255,255,0.6)',
    pulseBoxShadow: '',
    timerColor: 'rgba(59,130,246,0.95)',
  },
  RESERVED: {
    border: '2px solid rgba(139,92,246,0.7)',
    boxShadow:
      '0 0 0 1px rgba(139,92,246,0.18), 0 0 14px rgba(139,92,246,0.12), inset 0 1px 0 rgba(255,255,255,0.6)',
    pulseBoxShadow: '',
    timerColor: 'rgba(139,92,246,0.95)',
  },
  DIRTY: {
    border: '2px solid rgba(245,158,11,0.7)',
    boxShadow:
      '0 0 0 1px rgba(245,158,11,0.18), 0 0 14px rgba(245,158,11,0.12), inset 0 1px 0 rgba(255,255,255,0.6)',
    pulseBoxShadow: '',
    timerColor: 'rgba(245,158,11,0.95)',
  },
};

function normalizeStatus(status?: string): string {
  if (!status) return 'FREE';
  const s = status.toUpperCase();
  if (s === 'AVAILABLE' || s === 'FREE') return 'FREE';
  if (s === 'READY' || s === 'BILLED' || s === 'BILL_REQUESTED') return 'BILL_REQUESTED';
  if (s === 'OCCUPIED') return 'OCCUPIED';
  if (s === 'RESERVED') return 'RESERVED';
  if (s === 'DIRTY') return 'DIRTY';
  if (STATUS_CONFIG[s]) return s;
  return 'FREE';
}

function getTableDimensions(shape?: string, capacity: number = 4) {
  const normShape = (shape || '').toLowerCase();

  if (normShape === 'round' || normShape === 'table_round') {
    return { width: 96, height: 96, borderRadius: '50%' };
  }
  if (normShape === 'long' || capacity >= 9) {
    return { width: 180, height: 80, borderRadius: '10px' };
  }
  if (normShape === 'rectangle' || (capacity >= 5 && capacity <= 8)) {
    return { width: 130, height: 88, borderRadius: '12px' };
  }
  return { width: 88, height: 88, borderRadius: '12px' };
}

interface ChairPosition {
  x: number;
  y: number;
}

function calculateChairs(capacity: number, shape: string, w: number, h: number): ChairPosition[] {
  const chairs: ChairPosition[] = [];
  const cap = Math.max(1, capacity);
  const isRound = shape.toLowerCase() === 'round' || shape.toLowerCase() === 'table_round';

  if (isRound) {
    const cx = 20 + w / 2;
    const cy = 20 + h / 2;
    const radius = w / 2 + 13;

    for (let i = 0; i < cap; i++) {
      const angle = (2 * Math.PI / cap) * i - Math.PI / 2;
      chairs.push({
        x: Math.round(cx + radius * Math.cos(angle) - 5),
        y: Math.round(cy + radius * Math.sin(angle) - 5),
      });
    }
    return chairs;
  }

  let topBottomCount: number;
  let sideCount: number;

  if (cap <= 2) {
    topBottomCount = 1;
    sideCount = 0;
  } else if (cap <= 4) {
    topBottomCount = 1;
    sideCount = 1;
  } else {
    sideCount = 1;
    topBottomCount = Math.floor((cap - 2) / 2);
  }

  const topY = 20 - 13;
  const bottomY = 20 + h + 3;
  const leftX = 20 - 13;
  const rightX = 20 + w + 3;

  for (let i = 0; i < topBottomCount; i++) {
    const xFraction = (i + 1) / (topBottomCount + 1);
    chairs.push({ x: Math.round(20 + w * xFraction - 5), y: topY });
  }

  for (let i = 0; i < sideCount; i++) {
    const yFraction = (i + 1) / (sideCount + 1);
    chairs.push({ x: rightX, y: Math.round(20 + h * yFraction - 5) });
  }

  for (let i = 0; i < topBottomCount; i++) {
    const xFraction = (i + 1) / (topBottomCount + 1);
    chairs.push({ x: Math.round(20 + w * xFraction - 5), y: bottomY });
  }

  for (let i = 0; i < sideCount; i++) {
    const yFraction = (i + 1) / (sideCount + 1);
    chairs.push({ x: leftX, y: Math.round(20 + h * yFraction - 5) });
  }

  return chairs;
}

export function PremiumTable({
  label,
  capacity,
  shape = 'square',
  status = 'FREE',
  occupiedSince,
  isSelected = false,
  onClick,
  className = '',
  style = {},
}: PremiumTableProps) {
  const normStatus = normalizeStatus(status);
  const isOccupied = normStatus === 'OCCUPIED';
  const isBillRequested = normStatus === 'BILL_REQUESTED';
  const showTimer = isOccupied || isBillRequested;
  const statusStyle = STATUS_CONFIG[normStatus] || STATUS_CONFIG.FREE;

  const { width, height, borderRadius } = getTableDimensions(shape, capacity);
  const wrapperWidth = width + 40;
  const wrapperHeight = height + 40;

  const [elapsedTime, setElapsedTime] = useState<string>('');

  useEffect(() => {
    if (!showTimer) {
      setElapsedTime('');
      return;
    }

    const computeTimer = () => {
      if (!occupiedSince) {
        setElapsedTime('24m');
        return;
      }
      const startTime = typeof occupiedSince === 'string' ? new Date(occupiedSince).getTime() : new Date(occupiedSince).getTime();
      const diffMs = Math.max(0, Date.now() - startTime);
      const mins = Math.floor(diffMs / 60000);
      if (mins < 60) {
        setElapsedTime(`${mins}m`);
      } else {
        const hrs = Math.floor(mins / 60);
        const remMins = mins % 60;
        setElapsedTime(`${hrs}h ${remMins}m`);
      }
    };

    computeTimer();
    const interval = setInterval(computeTimer, 60000);
    return () => clearInterval(interval);
  }, [isOccupied, occupiedSince]);

  const chairs = useMemo(
    () => calculateChairs(capacity, shape, width, height),
    [capacity, shape, width, height]
  );

  return (
    <div
      onClick={onClick}
      style={{
        width: `${wrapperWidth}px`,
        height: `${wrapperHeight}px`,
        position: 'relative',
        userSelect: 'none',
        ...style,
      }}
      className={`group cursor-pointer flex items-center justify-center ${className}`}
    >
      <style jsx>{`
        @keyframes occupiedPulse {
          0%, 100% {
            box-shadow: 0 0 0 1px rgba(239, 68, 68, 0.2), 0 0 18px rgba(239, 68, 68, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.6);
          }
          50% {
            box-shadow: 0 0 0 1px rgba(239, 68, 68, 0.35), 0 0 24px rgba(239, 68, 68, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.6);
          }
        }
        .pulse-occupied {
          animation: occupiedPulse 2s infinite ease-in-out;
        }
      `}</style>

      {/* Perimeter Chairs */}
      {chairs.map((chair, index) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            left: `${chair.x}px`,
            top: `${chair.y}px`,
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: 'rgba(203, 213, 225, 0.8)',
            border: '1px solid rgba(148, 163, 184, 0.6)',
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* Light Table Surface */}
      <div
        style={{
          position: 'absolute',
          left: '20px',
          top: '20px',
          width: `${width}px`,
          height: `${height}px`,
          borderRadius,
          background: 'linear-gradient(145deg, #FFFFFF 0%, #F8FAFC 100%)',
          border: statusStyle.border,
          boxShadow: statusStyle.boxShadow,
          transition: 'border-color 0.4s ease, box-shadow 0.4s ease',
        }}
        className={`flex flex-col items-center justify-center text-center p-1 relative z-10 ${
          isOccupied ? 'pulse-occupied' : ''
        } ${
          isSelected
            ? 'ring-2 ring-amber-500 ring-offset-2 ring-offset-slate-100 scale-[1.02]'
            : ''
        }`}
      >
        {/* Table Number */}
        <span
          style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 700,
            fontSize: '15px',
            color: 'rgba(15, 23, 42, 0.95)',
            letterSpacing: '-0.01em',
            lineHeight: 1.1,
          }}
        >
          {label}
        </span>

        {/* Seat Count */}
        <span
          style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 400,
            fontSize: '10px',
            color: 'rgba(100, 116, 139, 0.85)',
            marginTop: '2px',
            lineHeight: 1,
          }}
        >
          {capacity} seats
        </span>

        {/* Timer for OCCUPIED and BILL_REQUESTED Tables */}
        {showTimer && elapsedTime && (
          <span
            style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              fontSize: '10px',
              color: statusStyle.timerColor,
              marginTop: '2px',
              lineHeight: 1,
            }}
          >
            {elapsedTime}
          </span>
        )}
      </div>
    </div>
  );
}
