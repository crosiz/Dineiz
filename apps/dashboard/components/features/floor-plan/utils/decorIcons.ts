import {
  Trees, Leaf, Armchair, Sofa, Beer, ClipboardList,
  Building, GripVertical, ArrowUpDown, Bath, DoorOpen,
  Flame, Monitor, ChefHat, Sparkles, Image as ImageIcon,
  AlignVerticalSpaceAround, Presentation, Fish, Box
} from 'lucide-react';
import React from 'react';

export const DECOR_EMOJI_TO_ICON: Record<string, React.ElementType> = {
  '🪴': Trees,
  '🌴': Trees,
  '🌿': Leaf,
  '🪑': Armchair,
  '🛋️': Sofa,
  '🍺': Beer,
  '📋': ClipboardList,
  '🏛️': Building,
  '🪜': GripVertical,
  '🛗': ArrowUpDown,
  '🚻': Bath,
  '🚪': DoorOpen,
  '🧯': Flame,
  '🖥️': Monitor,
  '👨‍🍳': ChefHat,
  '✨': Sparkles,
  '🖼️': ImageIcon,
  '🎋': AlignVerticalSpaceAround,
  '🎭': Presentation,
  '🐠': Fish,
};

export const getDecorIcon = (emoji: string): React.ElementType => {
  return DECOR_EMOJI_TO_ICON[emoji] || Box;
};
