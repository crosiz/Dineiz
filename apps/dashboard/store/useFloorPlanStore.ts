import { create } from 'zustand';
import { TableElement, WallElement, DecorElement, ZoneElement } from '../lib/api/floor-plan';

type Tool = 'select' | 'table' | 'wall' | 'decor' | 'zone';

interface FloorPlanStateSnapshot {
  tables: TableElement[];
  walls: WallElement[];
  decor: DecorElement[];
  zones: ZoneElement[];
}

interface FloorPlanStore {
  // Canvas state
  tables: TableElement[];
  walls: WallElement[];
  decor: DecorElement[];
  zones: ZoneElement[];
  deletedTableIds: string[];

  selectedBranchId: string;

  selectedTableId: string | null;
  selectedElementId: string | null; // For walls, decor, zones
  selectedElementType: 'table' | 'wall' | 'decor' | 'zone' | null;
  pendingDecorPlacement: { id: string, emoji: string, label: string } | null;

  isDirty: boolean;              // unsaved changes exist
  activeTool: Tool;
  zoom: number;                  // 0.5 to 2.0, default 1
  panX: number;
  panY: number;
  gridSnap: boolean;
  showGrid: boolean;
  showTableStatus: boolean;      // toggle live order status overlay
  activeFloor: number;           // current floor number (1, 2, 3...)
  floors: number[];              // available floor numbers

  undoStack: FloorPlanStateSnapshot[];   // for undo/redo
  redoStack: FloorPlanStateSnapshot[];

  // Actions
  setTables: (tables: TableElement[]) => void;
  setWalls: (walls: WallElement[]) => void;
  setDecor: (decor: DecorElement[]) => void;
  setZones: (zones: ZoneElement[]) => void;

  addTable: (table: TableElement) => void;
  updateTable: (id: string, updates: Partial<TableElement>) => void;
  deleteTable: (id: string) => void;

  addWall: (wall: WallElement) => void;
  updateWall: (id: string, updates: Partial<WallElement>) => void;
  deleteWall: (id: string) => void;

  addDecor: (decor: DecorElement) => void;
  updateDecor: (id: string, updates: Partial<DecorElement>) => void;
  deleteDecor: (id: string) => void;

  addZone: (zone: ZoneElement) => void;
  updateZone: (id: string, updates: Partial<ZoneElement>) => void;
  deleteZone: (id: string) => void;

  selectTable: (id: string | null) => void;
  selectElement: (id: string | null, type: 'table' | 'wall' | 'decor' | 'zone' | null) => void;

  setSelectedBranchId: (id: string) => void;

  setActiveTool: (tool: Tool) => void;
  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
  toggleGridSnap: () => void;
  toggleGrid: () => void;
  toggleTableStatus: () => void;
  setActiveFloor: (floor: number) => void;
  setPendingDecorPlacement: (item: { id: string, emoji: string, label: string } | null) => void;
  addFloor: () => void;
  removeFloor: (floor: number) => void;

  undo: () => void;
  redo: () => void;
  markDirty: () => void;
  markClean: () => void;
  clearCanvas: () => void;
  pushUndoState: () => void;

  generateTableLabel: (floor: number) => string;
}

export const useFloorPlanStore = create<FloorPlanStore>((set, get) => ({
  tables: [],
  walls: [],
  decor: [],
  zones: [],
  deletedTableIds: [],

  selectedBranchId: '',

  selectedTableId: null,
  selectedElementId: null,
  selectedElementType: null,
  pendingDecorPlacement: null,

  isDirty: false,
  activeTool: 'select',
  zoom: 1,
  panX: 0,
  panY: 0,
  gridSnap: true,
  showGrid: true,
  showTableStatus: false,
  activeFloor: 1,
  floors: [1],
  undoStack: [],
  redoStack: [],

  setTables: (tables) => set({ tables }),
  setWalls: (walls) => set({ walls }),
  setDecor: (decor) => set({ decor }),
  setZones: (zones) => set({ zones }),

  addTable: (table) => set((state) => {
    return { tables: [...state.tables, table], isDirty: true };
  }),

  updateTable: (id, updates) => set((state) => {
    const newTables = state.tables.map(t => t.id === id ? { ...t, ...updates } : t);
    return { tables: newTables, isDirty: true };
  }),

  deleteTable: (id) => set((state) => {
    const newTables = state.tables.filter(t => t.id !== id);
    const newDeletedIds = !id.startsWith('temp_') ? [...state.deletedTableIds, id] : state.deletedTableIds;
    return { tables: newTables, deletedTableIds: newDeletedIds, isDirty: true };
  }),

  addWall: (wall) => set((state) => ({ walls: [...state.walls, wall], isDirty: true })),
  updateWall: (id, updates) => set((state) => ({
    walls: state.walls.map(w => w.id === id ? { ...w, ...updates } : w),
    isDirty: true
  })),
  deleteWall: (id) => set((state) => ({
    walls: state.walls.filter(w => w.id !== id),
    isDirty: true
  })),

  addDecor: (decor) => set((state) => ({ decor: [...state.decor, decor], isDirty: true })),
  updateDecor: (id, updates) => set((state) => ({
    decor: state.decor.map(d => d.id === id ? { ...d, ...updates } : d),
    isDirty: true
  })),
  deleteDecor: (id) => set((state) => ({
    decor: state.decor.filter(d => d.id !== id),
    isDirty: true
  })),

  addZone: (zone) => set((state) => ({ zones: [...state.zones, zone], isDirty: true })),
  updateZone: (id, updates) => set((state) => ({
    zones: state.zones.map(z => z.id === id ? { ...z, ...updates } : z),
    isDirty: true
  })),
  deleteZone: (id) => set((state) => ({
    zones: state.zones.filter(z => z.id !== id),
    isDirty: true
  })),

  selectTable: (id) => set({ selectedTableId: id, selectedElementId: id, selectedElementType: id ? 'table' : null }),
  selectElement: (id, type) => set({ selectedElementId: id, selectedElementType: type, selectedTableId: type === 'table' ? id : null }),

  setSelectedBranchId: (id) => set({ selectedBranchId: id }),

  setActiveTool: (tool) => set({ activeTool: tool }),

  setZoom: (zoom) => set({ zoom: Math.max(0.25, Math.min(zoom, 3.0)) }),

  setPan: (x, y) => set({ panX: x, panY: y }),

  toggleGridSnap: () => set((state) => ({ gridSnap: !state.gridSnap })),

  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),

  toggleTableStatus: () => set((state) => ({ showTableStatus: !state.showTableStatus })),

  setActiveFloor: (floor) => set({ activeFloor: floor, selectedElementId: null, selectedElementType: null, selectedTableId: null }),

  setPendingDecorPlacement: (item) => set({ pendingDecorPlacement: item }),

  addFloor: () => set((state) => {
    const newFloor = Math.max(...state.floors, 0) + 1;
    return { floors: [...state.floors, newFloor], activeFloor: newFloor };
  }),

  removeFloor: (floor) => set((state) => {
    const newFloors = state.floors.filter(f => f !== floor);
    if (newFloors.length === 0) newFloors.push(1);
    return { floors: newFloors, activeFloor: state.activeFloor === floor ? newFloors[0] : state.activeFloor };
  }),

  undo: () => set((state) => {
    if (state.undoStack.length === 0) return state;
    const previous = state.undoStack[state.undoStack.length - 1];
    const newUndoStack = state.undoStack.slice(0, -1);
    return {
      tables: previous.tables,
      walls: previous.walls,
      decor: previous.decor,
      zones: previous.zones,
      undoStack: newUndoStack,
      redoStack: [...state.redoStack, {
        tables: state.tables,
        walls: state.walls,
        decor: state.decor,
        zones: state.zones
      }],
      isDirty: true
    };
  }),

  redo: () => set((state) => {
    if (state.redoStack.length === 0) return state;
    const next = state.redoStack[state.redoStack.length - 1];
    const newRedoStack = state.redoStack.slice(0, -1);
    return {
      tables: next.tables,
      walls: next.walls,
      decor: next.decor,
      zones: next.zones,
      redoStack: newRedoStack,
      undoStack: [...state.undoStack, {
        tables: state.tables,
        walls: state.walls,
        decor: state.decor,
        zones: state.zones
      }],
      isDirty: true
    };
  }),

  markDirty: () => set({ isDirty: true }),

  markClean: () => set({ isDirty: false, deletedTableIds: [], undoStack: [], redoStack: [] }),

  clearCanvas: () => set({
    tables: [],
    walls: [],
    decor: [],
    zones: [],
    selectedTableId: null,
    selectedElementId: null,
    selectedElementType: null,
    isDirty: false,
    deletedTableIds: [],
    undoStack: [],
    redoStack: []
  }),

  pushUndoState: () => set((state) => ({
    undoStack: [...state.undoStack, {
      tables: [...state.tables],
      walls: [...state.walls],
      decor: [...state.decor],
      zones: [...state.zones],
    }],
    redoStack: [],
    isDirty: true
  })),

  generateTableLabel: (floor: number) => {
    const state = get();
    const floorTables = state.tables.filter(t => t.floor === floor);
    const usedNumbers = floorTables
      .map(t => t.label.replace(/\D/g, ''))
      .map(Number)
      .filter(Boolean);
    let n = 1;
    while (usedNumbers.includes(n)) n++;
    return `T-${n}`;
  }
}));
