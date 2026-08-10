'use client';

import React from 'react';

interface ZoneLabelProps {
  label: string;
  x: number;
  y: number;
}

export function ZoneLabel({ label, x, y }: ZoneLabelProps) {
  return (
    <div 
      className="absolute text-xs text-slate-400 uppercase tracking-widest font-bold pointer-events-none select-none opacity-60"
      style={{ left: x, top: y }}
    >
      {label}
    </div>
  );
}
