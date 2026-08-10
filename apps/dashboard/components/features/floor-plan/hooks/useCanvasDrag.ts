import { createSnapModifier } from '@dnd-kit/modifiers';
import { useFloorPlan } from './useFloorPlan';

export function useCanvasDrag() {
  const snapToGrid = useFloorPlan(s => s.snapToGrid);
  
  // Create a 24px grid snap modifier.
  // We only apply this modifier if `snapToGrid` is true.
  const snapToGridModifier = createSnapModifier(24);
  
  const modifiers = snapToGrid ? [snapToGridModifier] : [];

  return { modifiers };
}
