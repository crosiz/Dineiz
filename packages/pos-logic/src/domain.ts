// Literal-union types mirroring the SQLite CHECK constraints in
// apps/standalone/src/main/db/migrations/001_init.ts, shared between main and renderer.

export type UserRole = 'OWNER' | 'MANAGER' | 'CASHIER';
export type OrderStatus = 'PENDING' | 'IN_KITCHEN' | 'READY' | 'COMPLETED' | 'CANCELLED';
export type OrderType = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
export type TableStatus = 'FREE' | 'OCCUPIED' | 'RESERVED' | 'DIRTY' | 'INACTIVE';
export type ShiftStatus = 'OPEN' | 'CLOSED';
export type ShiftActivityType = 'BREAK_START' | 'BREAK_END' | 'CASH_IN' | 'CASH_OUT';
export type IngredientUnit = 'KG' | 'G' | 'L' | 'ML' | 'PCS';
export type StockMovementType = 'PURCHASE' | 'SALE_DEDUCTION' | 'ADJUSTMENT' | 'WASTAGE';
