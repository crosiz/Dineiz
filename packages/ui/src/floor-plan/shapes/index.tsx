import React from 'react';

export interface ShapeProps {
  width: number;
  height: number;
  color?: string;
  isOccupied?: boolean;
  status?: 'free' | 'occupied' | 'ready'; // From POS map
  label?: string;
  capacity?: number;
  isSelected?: boolean;
}

const getFillColor = (props: ShapeProps, defaultColor: string) => {
  if (props.status === 'occupied') return '#2A1010';
  if (props.status === 'ready') return '#0F1E3A';
  if (props.status === 'free') return '#162B1E';
  if (props.isOccupied) return '#2A1010';
  return props.color || 'var(--pos-bg-card)';
};

const getStrokeColor = (props: ShapeProps, isSelected?: boolean) => {
  if (isSelected) return '#3b82f6';
  if (props.status === 'occupied') return '#EF4444';
  if (props.status === 'ready') return '#3B82F6';
  if (props.status === 'free') return '#10B981';
  if (props.isOccupied) return '#EF4444';
  return '#374151';
};

const getGlow = (props: ShapeProps) => {
  if (props.status === 'occupied') return 'drop-shadow(0 0 8px rgba(239,68,68,0.4))';
  if (props.status === 'ready') return 'drop-shadow(0 0 8px rgba(59,130,246,0.4))';
  if (props.status === 'free') return 'drop-shadow(0 0 8px rgba(16,185,129,0.4))';
  return 'drop-shadow(2px 2px 3px rgba(0,0,0,0.2))';
};

// --- TABLES ---

export const RoundTable: React.FC<ShapeProps> = (props) => {
  const { width, height, label, capacity, isSelected } = props;
  const radius = Math.min(width, height) / 2;
  const fillColor = getFillColor(props, '#d1d5db');
  const strokeColor = getStrokeColor(props, isSelected);
  const glow = getGlow(props);

  // Draw small circles around for chairs
  const numChairs = capacity || 4;
  const chairRadius = radius * 0.2;
  const tableRadius = radius * 0.8;
  const chairs = [];
  for (let i = 0; i < numChairs; i++) {
    const angle = (i * 2 * Math.PI) / numChairs;
    const cx = radius + Math.cos(angle) * (tableRadius + chairRadius);
    const cy = radius + Math.sin(angle) * (tableRadius + chairRadius);
    chairs.push(<circle key={i} cx={cx} cy={cy} r={chairRadius} fill="var(--pos-bg-card)" stroke="#374151" strokeWidth="1" />);
  }

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      <g style={{ filter: glow }}>
        {chairs}
        <circle cx={radius} cy={radius} r={tableRadius} fill={fillColor} stroke={strokeColor} strokeWidth={isSelected ? 3 : 2} />
        {label && (
          <text x={radius} y={radius} textAnchor="middle" dominantBaseline="central" fontSize={radius * 0.4} fill="#FFFFFF" fontWeight="bold">
            {label}
          </text>
        )}
      </g>
    </svg>
  );
};

export const SquareTable: React.FC<ShapeProps> = (props) => {
  const { width, height, label, isSelected } = props;
  const fillColor = getFillColor(props, '#d1d5db');
  const strokeColor = getStrokeColor(props, isSelected);
  const glow = getGlow(props);
  
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      <g style={{ filter: glow }}>
        <rect x="10%" y="10%" width="80%" height="80%" rx="4" fill={fillColor} stroke={strokeColor} strokeWidth={isSelected ? 3 : 2} />
        {label && (
          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontSize={Math.min(width, height) * 0.3} fill="#FFFFFF" fontWeight="bold">
            {label}
          </text>
        )}
      </g>
    </svg>
  );
};

export const RectangleTable: React.FC<ShapeProps> = (props) => {
  const { width, height, label, isSelected } = props;
  const fillColor = getFillColor(props, '#d1d5db');
  const strokeColor = getStrokeColor(props, isSelected);
  const glow = getGlow(props);
  
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      <g style={{ filter: glow }}>
        <rect x="5%" y="10%" width="90%" height="80%" rx="4" fill={fillColor} stroke={strokeColor} strokeWidth={isSelected ? 3 : 2} />
        {label && (
          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontSize={Math.min(width, height) * 0.4} fill="#FFFFFF" fontWeight="bold">
            {label}
          </text>
        )}
      </g>
    </svg>
  );
};

export const BoothTable: React.FC<ShapeProps> = (props) => {
  const { width, height, label, isSelected } = props;
  const fillColor = getFillColor(props, '#d1d5db');
  const strokeColor = getStrokeColor(props, isSelected);
  const glow = getGlow(props);
  
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      <g style={{ filter: glow }}>
        {/* Seats */}
        <rect x="0" y="0" width="100%" height="20%" rx="2" fill="var(--pos-bg-card)" stroke="#374151" strokeWidth="1" />
        <rect x="0" y="80%" width="100%" height="20%" rx="2" fill="var(--pos-bg-card)" stroke="#374151" strokeWidth="1" />
        {/* Table */}
        <rect x="5%" y="25%" width="90%" height="50%" rx="4" fill={fillColor} stroke={strokeColor} strokeWidth={isSelected ? 3 : 2} />
        {label && (
          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontSize={Math.min(width, height) * 0.3} fill="#FFFFFF" fontWeight="bold">
            {label}
          </text>
        )}
      </g>
    </svg>
  );
};

// --- STRUCTURE ---

export const Wall: React.FC<ShapeProps> = (props) => {
  const { width, height, isSelected } = props;
  const fillColor = props.color || '#374151'; // gray-700
  const strokeColor = isSelected ? '#3b82f6' : 'none';
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
      <rect x="0" y="0" width="100%" height="100%" fill={fillColor} stroke={strokeColor} strokeWidth={isSelected ? 3 : 0} />
    </svg>
  );
};

export const WindowShape: React.FC<ShapeProps> = (props) => {
  const { width, height, isSelected } = props;
  const strokeColor = isSelected ? '#3b82f6' : '#94a3b8';
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
      <rect x="0" y="0" width="100%" height="100%" fill="#e2e8f0" stroke={strokeColor} strokeWidth={isSelected ? 3 : 1} />
      <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#cbd5e1" strokeWidth="2" />
    </svg>
  );
};

export const Door: React.FC<ShapeProps> = (props) => {
  const { width, height, isSelected } = props;
  const strokeColor = isSelected ? '#3b82f6' : '#475569';
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
      <rect x="0" y="0" width="20%" height="100%" fill="#475569" stroke={strokeColor} strokeWidth={isSelected ? 2 : 0} />
      <path d={`M ${width*0.2} ${height} A ${width*0.8} ${height} 0 0 1 ${width} 0`} fill="none" stroke="#94a3b8" strokeWidth="1" strokeDasharray="4" />
      <line x1={width*0.2} y1={height} x2={width} y2={height} stroke="#475569" strokeWidth="3" />
    </svg>
  );
};

export const Pillar: React.FC<ShapeProps> = (props) => {
  const { width, height, isSelected } = props;
  const strokeColor = isSelected ? '#3b82f6' : 'var(--pos-bg-elevated)';
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
      <rect x="0" y="0" width="100%" height="100%" fill="#cbd5e1" stroke={strokeColor} strokeWidth={isSelected ? 3 : 1} />
      <line x1="0" y1="0" x2="100%" y2="100%" stroke="#94a3b8" strokeWidth="1" />
      <line x1="100%" y1="0" x2="0" y2="100%" stroke="#94a3b8" strokeWidth="1" />
    </svg>
  );
};

// --- DECOR ---

export const Plant: React.FC<ShapeProps> = (props) => {
  const { width, height, isSelected } = props;
  const radius = Math.min(width, height) / 2;
  const strokeColor = isSelected ? '#3b82f6' : '#15803d';
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      <g style={{ filter: 'drop-shadow(2px 2px 3px rgba(0,0,0,0.2))' }}>
        <circle cx={radius} cy={radius} r={radius * 0.9} fill="#22c55e" stroke={strokeColor} strokeWidth={isSelected ? 3 : 1} />
        {/* Inner leaves */}
        <path d={`M ${radius} ${radius} Q ${radius*0.5} ${radius*0.2} ${radius} ${radius*0.1} Q ${radius*1.5} ${radius*0.2} ${radius} ${radius}`} fill="#16a34a" />
        <path d={`M ${radius} ${radius} Q ${radius*1.8} ${radius*0.5} ${radius*1.9} ${radius} Q ${radius*1.8} ${radius*1.5} ${radius} ${radius}`} fill="#16a34a" />
        <path d={`M ${radius} ${radius} Q ${radius*1.5} ${radius*1.8} ${radius} ${radius*1.9} Q ${radius*0.5} ${radius*1.8} ${radius} ${radius}`} fill="#16a34a" />
        <path d={`M ${radius} ${radius} Q ${radius*0.2} ${radius*1.5} ${radius*0.1} ${radius} Q ${radius*0.2} ${radius*0.5} ${radius} ${radius}`} fill="#16a34a" />
      </g>
    </svg>
  );
};

export const Divider: React.FC<ShapeProps> = (props) => {
  const { width, height, isSelected } = props;
  const strokeColor = isSelected ? '#3b82f6' : '#64748b';
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
      <rect x="40%" y="0" width="20%" height="100%" fill="#94a3b8" opacity="0.8" stroke={strokeColor} strokeWidth={isSelected ? 2 : 1} />
    </svg>
  );
};

// Map component types to components
export const ShapeComponents: Record<string, React.FC<ShapeProps>> = {
  table_round: RoundTable,
  table_square: SquareTable,
  table_rectangle: RectangleTable,
  table_booth: BoothTable,
  wall: Wall,
  door: Door,
  window: WindowShape,
  pillar: Pillar,
  plant: Plant,
  divider: Divider,
  // Fallbacks
  chair: RoundTable,
  sofa: BoothTable,
  bar_stool: RoundTable,
  counter: Wall,
  kitchen_window: WindowShape,
  bar: Wall,
  stairs: Wall,
  elevator: Wall,
  bathroom: Wall,
  reception: Wall,
};
