import { apiFetch } from '../api';

export interface TableElement {
  id: string;
  label: string;
  capacity: number;
  shape: 'square' | 'round' | 'rectangle' | 'booth';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  floor: number;
  zone?: string;
  allowReservations: boolean;
  joinable: boolean;
  isActive: boolean;
  status?: 'available' | 'occupied' | 'reserved' | 'dirty';
  activeOrderId?: string;
  guestCount?: number;
  occupiedSince?: string;
}

export interface WallElement {
  id: string;
  floor: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  thickness: number;
  color?: string;
  type: 'solid' | 'glass' | 'partition' | 'exterior';
}

export interface DecorElement {
  id: string;
  floor: number;
  type: string;
  emoji: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scale: number;
  color?: string;
}

export interface ZoneElement {
  id: string;
  floor: number;
  name: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color?: string;
  opacity?: number;
}

export interface SaveFloorPlanDto {
  tables: any[];
  floors: any;
}

export interface CreateTableDto {
  branchId: string;
  tenantId?: string;
  label: string;
  capacity: number;
  shape: 'square' | 'round' | 'rectangle' | 'booth';
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  rotation: number;
  floorNumber: number;
  zone?: string;
  allowReservations?: boolean;
  joinable?: boolean;
  isActive: boolean;
}

export interface UpdateTableDto extends Partial<CreateTableDto> {
  id?: string;
}

export const floorPlanApi = {
  getFloorPlan: (branchId: string) =>
    apiFetch<any>(`/api/floor-plan/${branchId}`),

  saveFloorPlan: (branchId: string, data: SaveFloorPlanDto) =>
    apiFetch<any>(`/api/floor-plan/${branchId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getTables: (branchId: string) =>
    apiFetch<any>(`/api/floor-plan/${branchId}/tables`),

  createTable: (branchId: string, data: CreateTableDto) =>
    apiFetch<any>(`/api/floor-plan/${branchId}/tables`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateTable: (tableId: string, data: UpdateTableDto) =>
    apiFetch<any>(`/api/tables/${tableId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  putTable: (tableId: string, data: UpdateTableDto) =>
    apiFetch<any>(`/api/tables/${tableId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteTable: (tableId: string) =>
    apiFetch<any>(`/api/tables/${tableId}`, {
      method: 'DELETE',
    }),

  bulkUpdateTables: (branchId: string, tables: UpdateTableDto[]) =>
    apiFetch<any>(`/api/floor-plan/${branchId}/tables/bulk`, {
      method: 'PATCH',
      body: JSON.stringify({ tables }),
    }),

  getTableOrders: (branchId: string) =>
    apiFetch<any>(`/api/floor-plan/${branchId}/table-orders`),

  duplicateTable: (tableId: string) =>
    apiFetch<any>(`/api/floor-plan/tables/${tableId}/duplicate`, {
      method: 'POST',
    }),
};
