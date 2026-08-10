import { create } from 'zustand';

export type TableShape = 'SQUARE' | 'ROUND' | 'RECTANGLE';

export interface FloorPlanTable {
  id: string;
  name: string;
  x: number;
  y: number;
  shape: TableShape;
  capacity: number;
  width: number;
  height: number;
  rotation: number;
  zone: string;
  allowReservations: boolean;
  joinable: boolean;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED';
}

interface FloorPlanState {
  tables: FloorPlanTable[];
  selectedTableId: string | null;
  activeTool: string;
  zoomLevel: number;
  snapToGrid: boolean;
  lastAutosaved: Date | null;
  mouseCoords: { x: number, y: number };
  
  setTables: (tables: FloorPlanTable[]) => void;
  updateTable: (id: string, updates: Partial<FloorPlanTable>) => void;
  addTable: (table: FloorPlanTable) => void;
  removeTable: (id: string) => void;
  duplicateTable: (id: string) => void;
  setSelectedTableId: (id: string | null) => void;
  setActiveTool: (tool: string) => void;
  setZoomLevel: (zoom: number) => void;
  setSnapToGrid: (snap: boolean) => void;
  setMouseCoords: (coords: { x: number, y: number }) => void;
  setLastAutosaved: (date: Date) => void;
}

// Initial mock data for testing
const INITIAL_TABLES: FloorPlanTable[] = [
  { id: 't-1', name: 'T-1', x: 120, y: 120, shape: 'SQUARE', capacity: 4, width: 80, height: 80, rotation: 0, zone: 'Main Dining Hall', allowReservations: true, joinable: false, status: 'AVAILABLE' },
  { id: 't-2', name: 'T-2', x: 240, y: 120, shape: 'SQUARE', capacity: 4, width: 80, height: 80, rotation: 0, zone: 'Main Dining Hall', allowReservations: true, joinable: false, status: 'OCCUPIED' },
  { id: 't-3', name: 'T-3', x: 360, y: 120, shape: 'SQUARE', capacity: 4, width: 80, height: 80, rotation: 0, zone: 'Main Dining Hall', allowReservations: true, joinable: false, status: 'RESERVED' },
  { id: 't-4', name: 'T-4', x: 120, y: 300, shape: 'ROUND', capacity: 6, width: 100, height: 100, rotation: 0, zone: 'Private Booths', allowReservations: true, joinable: true, status: 'AVAILABLE' },
  { id: 't-5', name: 'T-5', x: 280, y: 300, shape: 'RECTANGLE', capacity: 8, width: 160, height: 80, rotation: 0, zone: 'Private Booths', allowReservations: false, joinable: true, status: 'AVAILABLE' },
];

export const useFloorPlan = create<FloorPlanState>((set) => ({
  tables: INITIAL_TABLES,
  selectedTableId: null,
  activeTool: 'SELECT',
  zoomLevel: 100,
  snapToGrid: true,
  lastAutosaved: null,
  mouseCoords: { x: 0, y: 0 },

  setTables: (tables) => set({ tables }),
  
  updateTable: (id, updates) => set((state) => ({
    tables: state.tables.map(t => t.id === id ? { ...t, ...updates } : t)
  })),

  addTable: (table) => set((state) => ({
    tables: [...state.tables, table]
  })),

  removeTable: (id) => set((state) => ({
    tables: state.tables.filter(t => t.id !== id),
    selectedTableId: state.selectedTableId === id ? null : state.selectedTableId
  })),

  duplicateTable: (id) => set((state) => {
    const table = state.tables.find(t => t.id === id);
    if (!table) return state;
    
    const newTable = {
      ...table,
      id: `t-${Date.now()}`,
      name: `${table.name} (Copy)`,
      x: table.x + 24, // offset slightly
      y: table.y + 24
    };
    
    return { tables: [...state.tables, newTable], selectedTableId: newTable.id };
  }),

  setSelectedTableId: (id) => set({ selectedTableId: id }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setZoomLevel: (zoom) => set({ zoomLevel: zoom }),
  setSnapToGrid: (snap) => set({ snapToGrid: snap }),
  setMouseCoords: (coords) => set({ mouseCoords: coords }),
  setLastAutosaved: (date) => set({ lastAutosaved: date })
}));
