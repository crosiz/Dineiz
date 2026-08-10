import React from 'react';
import { useFloorPlanStore } from '../../../../store/useFloorPlanStore';
import { getDecorIcon } from '../utils/decorIcons';

const DECOR_ITEMS = [
  // Plants
  { id: 'plant_pot', emoji: '🪴', label: 'Potted Plant', category: 'Plants' },
  { id: 'palm', emoji: '🌴', label: 'Palm Tree', category: 'Plants' },
  { id: 'bush', emoji: '🌿', label: 'Bush/Hedge', category: 'Plants' },
  // Furniture
  { id: 'chair', emoji: '🪑', label: 'Chair', category: 'Furniture' },
  { id: 'sofa', emoji: '🛋️', label: 'Sofa', category: 'Furniture' },
  { id: 'bar_counter', emoji: '🍺', label: 'Bar Counter', category: 'Furniture' },
  { id: 'host_stand', emoji: '📋', label: 'Host Stand', category: 'Furniture' },
  // Structure
  { id: 'pillar', emoji: '🏛️', label: 'Pillar', category: 'Structure' },
  { id: 'stairs', emoji: '🪜', label: 'Stairs', category: 'Structure' },
  { id: 'elevator', emoji: '🛗', label: 'Elevator', category: 'Structure' },
  // Amenities
  { id: 'restroom', emoji: '🚻', label: 'Restrooms', category: 'Amenities' },
  { id: 'exit', emoji: '🚪', label: 'Exit Door', category: 'Amenities' },
  { id: 'fire_ext', emoji: '🧯', label: 'Fire Exit', category: 'Amenities' },
  { id: 'pos_terminal', emoji: '🖥️', label: 'POS Terminal', category: 'Amenities' },
  { id: 'kitchen_entry', emoji: '👨‍🍳', label: 'Kitchen Entry', category: 'Amenities' },
  // Decor
  { id: 'chandelier', emoji: '✨', label: 'Chandelier', category: 'Decor' },
  { id: 'wall_art', emoji: '🖼️', label: 'Wall Art', category: 'Decor' },
  { id: 'divider', emoji: '🎋', label: 'Room Divider', category: 'Decor' },
  { id: 'stage', emoji: '🎭', label: 'Stage/Platform', category: 'Decor' },
  { id: 'fish_tank', emoji: '🐠', label: 'Fish Tank', category: 'Decor' },
];

export function DecorPickerPanel() {
  const { activeTool, setPendingDecorPlacement } = useFloorPlanStore();

  if (activeTool !== 'decor') return null;

  const categories = Array.from(new Set(DECOR_ITEMS.map(i => i.category)));

  return (
    <div className="absolute left-16 top-0 bottom-0 w-56 bg-slate-900 border-r border-slate-700 shadow-lg z-40 overflow-y-auto no-scrollbar">
      <div className="p-3 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
        <h3 className="text-xs font-bold uppercase text-slate-300">Add Decor</h3>
      </div>
      
      <div className="p-3 flex flex-col gap-4">
        {categories.map(categoryName => {
          const items = DECOR_ITEMS.filter(i => i.category === categoryName);
          return (
            <div key={categoryName}>
              <h4 className="text-[10px] font-bold text-slate-500 mb-2 uppercase">{categoryName}</h4>
              <div className="grid grid-cols-2 gap-2">
                {items.map(item => (
                  <button
                    key={item.id}
                    className="flex flex-col items-center justify-center p-2 rounded-lg border border-slate-800 hover:bg-slate-800 hover:border-slate-700 transition-colors bg-slate-900/50"
                    onClick={() => {
                      setPendingDecorPlacement({ id: item.id, emoji: item.emoji, label: item.label });
                    }}
                  >
                    {(() => {
                      const Icon = getDecorIcon(item.emoji);
                      return <Icon className="w-6 h-6 mb-1 text-slate-400" />;
                    })()}
                    <span className="text-[9px] text-slate-400 text-center leading-tight">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
