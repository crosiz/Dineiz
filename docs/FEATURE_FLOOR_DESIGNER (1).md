# Dineiz — Restaurant Floor Plan Designer
## Feature Specification v1.0

---

## Overview

The Restaurant Floor Plan Designer is a drag-and-drop 2.5D visual tool built into
the Dineiz dashboard. Branch managers design their restaurant layout once.
Cashiers then see a live table map on the POS showing which tables are free or
occupied in real time.

**Where it lives:** `apps/dashboard/app/(dashboard)/floor-plan/page.tsx`
**Who uses it:** BRANCH_MANAGER (edit mode), CASHIER via POS (view-only mode)
**POS view:** `apps/pos/app/(pos)/tables/page.tsx`

---

## Tech Stack for This Feature

### Recommended Libraries

**Option A — React Flow (recommended)**
- Library: `@xyflow/react` (React Flow v12)
- Why: purpose-built for node-based drag-and-drop editors, handles zoom/pan,
  custom nodes, selection, and connection lines out of the box
- Install: `pnpm add @xyflow/react`
- Docs: https://reactflow.dev

**Option B — Konva.js**
- Library: `react-konva` + `konva`
- Why: canvas-based, better performance for very large floor plans with 50+ tables
- Install: `pnpm add react-konva konva`
- Use this if React Flow feels slow during testing

**3D Assets / Icons**
- Use flat 2.5D SVG icons (top-down view) — NOT full 3D. True 3D (Three.js) is
  overkill for a POS floor plan and will be slow on tablets. 2.5D (isometric-style
  flat SVGs viewed from above) gives the visual depth without the complexity.
- Icon source: custom SVG components built inline — shapes for table, chair, sofa,
  counter, bar stool, booth, plant, pillar, wall, door, window, stairs, bathroom
- Each shape is a React component that renders an SVG

**State Management**
- Zustand store: `useFloorPlanStore` — holds all placed items, floor dimensions,
  active floor number
- Persist to database via `PUT /api/floor-plan/:branchId`
- Load from database via `GET /api/floor-plan/:branchId`

**POS Real-time Table Status**
- Socket.IO: when an order is assigned to a table, emit `table:occupied` event
- POS floor plan subscribes to these events and updates table colors live

---

## Database Schema

Add to `packages/db/prisma/schema.prisma`:

```prisma
model FloorPlan {
  id        String   @id @default(cuid())
  branchId  String   @unique
  branch    Branch   @relation(fields: [branchId], references: [id])
  floors    Json     // array of FloorData objects (see below)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Table {
  id          String   @id @default(cuid())
  branchId    String
  branch      Branch   @relation(fields: [branchId], references: [id])
  tenantId    String
  label       String   // "T1", "T2", "VIP-1", "Bar 3"
  capacity    Int      // how many people can sit
  shape       String   // "round" | "square" | "rectangle" | "booth"
  floorNumber Int      @default(1)
  positionX   Float    // saved position on canvas
  positionY   Float
  width       Float
  height      Float
  rotation    Float    @default(0)
  isActive    Boolean  @default(true)
  orders      Order[]  // active orders on this table
  createdAt   DateTime @default(now())
}
```

The `floors` JSON field in `FloorPlan` stores the full canvas state:

```typescript
interface FloorData {
  floorNumber: number
  floorName: string        // "Ground Floor", "First Floor", "Rooftop"
  width: number            // canvas width in grid units
  height: number           // canvas height in grid units
  backgroundColor: string  // floor color "#F5F0E8"
  items: FloorItem[]
}

interface FloorItem {
  id: string
  type: FloorItemType
  x: number
  y: number
  width: number
  height: number
  rotation: number
  label?: string           // table label "T1", "VIP-3"
  capacity?: number        // for tables only
  tableId?: string         // links to Table record in DB
  shape?: string           // for tables: "round" | "square" | "rectangle" | "booth"
  color?: string           // custom color override
  locked?: boolean         // locked items cannot be moved accidentally
}

type FloorItemType =
  | 'table_round'
  | 'table_square'
  | 'table_rectangle'
  | 'table_booth'
  | 'chair'
  | 'sofa'
  | 'bar_stool'
  | 'counter'              // cashier counter
  | 'kitchen_window'       // pass-through window
  | 'bar'
  | 'wall'
  | 'door'
  | 'window'
  | 'pillar'
  | 'stairs'
  | 'elevator'
  | 'bathroom'
  | 'plant'
  | 'reception'
  | 'label_text'           // free text label anywhere on floor
```

---

## Feature 1 — Floor Plan Designer (Dashboard)

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  HEADER: Floor Plan Designer — Clifton Branch     [Save] [Preview]│
├──────────┬──────────────────────────────────────────┬───────────┤
│          │                                          │           │
│  LEFT    │         CANVAS (main editor)             │  RIGHT    │
│  PANEL   │                                          │  PANEL    │
│          │   drag items here from left panel        │           │
│ Shapes   │                                          │ Selected  │
│ library  │   zoom in/out with scroll                │ item      │
│          │   pan with middle mouse or space+drag    │ properties│
│ ──────   │                                          │           │
│ Tables   │                                          │ Label: T1 │
│ Chairs   │                                          │ Seats: 4  │
│ Sofas    │                                          │ Shape: ○  │
│ Walls    │                                          │ Rotation  │
│ Decor    │                                          │ Lock      │
│ Labels   │                                          │ Delete    │
│          │                                          │           │
├──────────┴──────────────────────────────────────────┴───────────┤
│  FLOOR TABS: [Ground Floor] [First Floor ✕] [Rooftop ✕] [+ Add] │
└─────────────────────────────────────────────────────────────────┘
```

### Left Panel — Shape Library

Organized into sections with 2.5D SVG icons:

**TABLES section:**
- Round table (2-seat, 4-seat, 6-seat variants)
- Square table (2-seat, 4-seat)
- Rectangle table (4-seat, 6-seat, 8-seat)
- Booth (2-side seating, L-shape)

**SEATING section:**
- Single chair
- Bar stool
- Sofa (2-seat, 3-seat)
- Bench

**STRUCTURE section:**
- Wall segment (horizontal, vertical)
- Door (single, double)
- Window
- Pillar / column
- Stairs
- Elevator

**SERVICE section:**
- Cashier counter
- Kitchen pass-through window
- Bar counter
- Reception desk
- Buffet table

**DECOR section:**
- Plant / potted tree
- Divider screen
- Rug / carpet area marker

**LABELS section:**
- Text label (type custom text anywhere)
- Zone label (VIP Zone, Smoking Area, etc.)

Each item in the library is draggable onto the canvas.
Clicking without dragging also places it at center of current view.

### Canvas Features

**Grid system:**
- Background grid (toggleable) — 20px squares representing ~0.5 meter
- Snap to grid toggle (default ON) — items snap to nearest grid point
- Grid size selector: Fine (10px) / Normal (20px) / Coarse (40px)

**Navigation:**
- Scroll to zoom in/out (10% to 400%)
- Space + drag to pan
- Minimap in bottom-right corner showing full floor with viewport indicator
- Zoom to fit button
- Zoom reset button (100%)

**Selection:**
- Click to select one item
- Shift+click to add to selection
- Click+drag on empty space to lasso-select multiple items
- Arrow keys to nudge selected items 1 grid unit at a time
- Delete/Backspace to remove selected items

**Item manipulation:**
- Drag to move
- Corner handles to resize (maintaining aspect ratio with Shift)
- Rotation handle at top (drag to rotate in 15-degree snaps, or type exact angle)
- Right-click context menu: Duplicate, Lock/Unlock, Bring to Front, Send to Back,
  Delete, Set as Table (converts any item into a bookable table)
- Double-click a table to quickly edit its label and capacity

**Multi-floor:**
- Add up to 6 floors per restaurant
- Rename each floor by double-clicking the tab
- Reorder floors by dragging tabs
- Delete a floor (with confirmation if it has tables)
- Each floor is completely independent canvas

**Boundary drawing:**
- "Draw boundary" mode: click to place corner points of the restaurant shape
- Creates a polygon representing the outer walls
- Inside the polygon is the floor area — colored with the floor color
- Outside is shown as a different shade to indicate outside the restaurant
- This gives the realistic restaurant shape (not just a rectangle)

**Undo / Redo:**
- Ctrl+Z to undo, Ctrl+Y or Ctrl+Shift+Z to redo
- 50 steps of history
- History shown in a tooltip on the undo button

### Right Panel — Properties

Shows when an item is selected:

**For tables:**
```
Table Label:     [T1          ]
Capacity:        [4  ] seats
Shape:           ○ Round  □ Square  ▭ Rectangle  ⊓ Booth
Section/Zone:    [Main Hall  ▾]
Color:           [● Default ▾]    (color picker)
Rotation:        [  0  °]
Lock position:   [toggle]
Merge with:      (select another table to merge for large parties)
─────────────────
[Duplicate]  [Delete]
```

**For walls/structure:**
```
Type:    Wall  Door  Window  Pillar
Width:   [    ] Height: [    ]
Color:   [       ]
Opacity: [████░░] 80%
Lock:    [toggle]
```

**For decorative items:**
```
Color:   [       ]
Scale:   [███░░░] 60%
Opacity: [████░░] 80%
Lock:    [toggle]
```

### Toolbar (top of canvas)

```
[Select ▸] [Boundary ⬡] [Wall ─] [Text T]  |  [Grid ⊞] [Snap ⊡]  |
[Undo ↩] [Redo ↪]  |  [Zoom 100% ▾] [Fit ⤢]  |  [Preview 👁] [Save 💾]
```

### Save Behavior

- Auto-save every 30 seconds (shows "Saving..." then "Saved" in top bar)
- Manual save button sends `PUT /api/floor-plan/:branchId` with full JSON state
- On save, the Table records in the database are synced:
  - New tables added to canvas → insert Table records
  - Tables removed from canvas → soft-delete Table records (mark inactive)
  - Table label or capacity changed → update Table records
- Show a success toast: "Floor plan saved. 12 tables active."

---

## Feature 2 — Table Map on POS (Cashier View)

### Where it appears

When a cashier taps "New Order" then selects "Dine-In", instead of a plain
table number dropdown they see a visual floor map of the restaurant.

**Route:** `apps/pos/app/(pos)/tables/page.tsx`

### Layout

```
┌──────────────────────────────────────────────────────────────┐
│  SELECT TABLE    [Ground Floor ▾]    Legend: ● Free ● Busy  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│     [visual floor plan — read-only]                          │
│                                                              │
│     Tables shown as they were designed in the dashboard      │
│                                                              │
│     ● Green = table is free → tap to start order            │
│     ● Red = table is occupied → shows order time elapsed     │
│     ● Yellow = table reserved (future feature)               │
│     ● Gray = table inactive / not available today            │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Behavior

**Table colors (real-time, via Socket.IO):**
- Free (no active order) → green fill
- Occupied (active order in progress) → red fill + shows time since order started
  e.g. "Table T5 — 23 min"
- Just ordered (order placed but kitchen not started) → orange fill
- Ready (food ready, waiting for customer to pay) → blue fill

**On tap:**
- Free table → immediately opens the new order screen with this table pre-selected
- Occupied table → shows a popup:
  ```
  Table T5 — 4 seats
  Order #047 — started 23 min ago
  Items: Zinger Burger x2, Fries x1, Cola x2
  Total so far: PKR 1,450

  [View Order]  [Add Items]  [Print Bill]  [Close]
  ```

**Floor switching:**
- If restaurant has multiple floors, show floor selector tabs at top
- Cashier can switch between floors to find available tables

**Real-time sync:**
- When another cashier assigns Table T3 to an order on their terminal,
  this terminal's table map turns T3 red immediately via Socket.IO
- No refresh needed

---

## Feature 3 — Table Management List (Dashboard)

In addition to the visual designer, provide a simple data table list view
at `/dashboard/floor-plan/tables` for quick bulk operations:

```
┌─────────────────────────────────────────────────────────────┐
│ Tables — Clifton Branch                    [+ Add Table]    │
├──────┬──────────┬──────────┬──────────┬────────┬───────────┤
│ Label│ Floor    │ Shape    │ Capacity │ Status │ Actions   │
├──────┼──────────┼──────────┼──────────┼────────┼───────────┤
│ T1   │ Ground   │ Round    │ 4        │ Active │ Edit Del  │
│ T2   │ Ground   │ Square   │ 2        │ Active │ Edit Del  │
│ VIP1 │ First    │ Booth    │ 6        │ Active │ Edit Del  │
│ BAR1 │ Ground   │ Bar Seat │ 1        │ Active │ Edit Del  │
└──────┴──────────┴──────────┴──────────┴────────┴───────────┘
```

Toggle a table inactive to temporarily remove it from the POS view
(e.g. table is broken, under maintenance).

---

## API Endpoints to Build

Add to `apps/api/src/routes/floor-plan.routes.ts`:

```typescript
// Get floor plan for a branch
GET /api/floor-plan/:branchId
Response: { floors: FloorData[], tables: Table[] }

// Save full floor plan
PUT /api/floor-plan/:branchId
Body: { floors: FloorData[] }
Response: { saved: true, tablesSync: { created: 3, updated: 5, deactivated: 1 } }

// Get all tables for a branch (used by POS)
GET /api/tables?branchId=xxx
Response: { tables: Table[] }

// Get live table status (which tables have active orders)
GET /api/tables/status?branchId=xxx
Response: { statuses: { tableId: string, status: 'free'|'occupied'|'ready', orderId?: string, since?: string }[] }

// Create a single table manually (from list view)
POST /api/tables
Body: { branchId, label, capacity, shape, floorNumber }

// Update a table
PUT /api/tables/:id
Body: { label?, capacity?, isActive? }

// Delete a table (soft delete)
DELETE /api/tables/:id
```

Socket.IO events to add in `apps/api/src/socket/`:

```typescript
// Emitted when a table's status changes
server.emit('table:status_changed', {
  branchId: string,
  tableId: string,
  status: 'free' | 'occupied' | 'ready',
  orderId?: string,
  since?: string
})

// POS subscribes to this on mount
socket.on('table:status_changed', (data) => {
  updateTableStatus(data.tableId, data.status)
})
```

---

## 2.5D SVG Shape Components

Build these as React components in `packages/ui/src/floor-plan/shapes/`:

Each component accepts: `width`, `height`, `rotation`, `color`, `isOccupied`,
`label`, `capacity`, `isSelected`.

### Table shapes (top-down 2.5D view):

**RoundTable.tsx** — circle with chairs around the perimeter
```
     [chair]
  [chair] [chair]
     [chair]
    ( table )
```
Rendered as SVG: outer circle for table surface, smaller circles around edge for chairs,
slight drop shadow to give 2.5D depth effect.

**SquareTable.tsx** — square with chairs on 4 sides
**RectangleTable.tsx** — rectangle with chairs on long sides
**BoothTable.tsx** — U-shape or L-shape bench seating

### Structure shapes:

**Wall.tsx** — thick rectangle, dark color, no transparency
**Door.tsx** — wall with arc indicating door swing direction
**Window.tsx** — thin rectangle with horizontal lines inside
**Pillar.tsx** — square with diagonal lines (hatch pattern)
**Stairs.tsx** — rectangle with parallel horizontal lines getting smaller (perspective)

### Service shapes:

**Counter.tsx** — thick L-shaped or straight rectangle with different color (dark wood tone)
**BarCounter.tsx** — curved or straight bar with stools indicated
**KitchenWindow.tsx** — rectangle with horizontal bars (pass-through window)

### Decor shapes:

**Plant.tsx** — circle with green fill and organic edge (plant top view)
**Divider.tsx** — thin tall rectangle, semi-transparent
**RugArea.tsx** — rectangle with dotted border, colored fill at 30% opacity

---

## Implementation Plan (give to Antigravity as tasks)

### Phase 1 — Database and API (do first)
1. Add `FloorPlan` and `Table` models to Prisma schema
2. Run migration
3. Build all 6 API endpoints listed above
4. Add Socket.IO `table:status_changed` event emission when order status changes

### Phase 2 — Dashboard Designer
5. Install `@xyflow/react`
6. Build `FloorPlanStore` (Zustand) with undo/redo history
7. Build all 15 SVG shape components in `packages/ui`
8. Build Left Panel (shape library with drag-to-canvas)
9. Build Canvas (React Flow custom nodes, grid, snap, zoom/pan)
10. Build Right Panel (properties editor)
11. Build multi-floor tabs
12. Build boundary drawing tool
13. Build toolbar with all buttons
14. Wire auto-save (every 30s) and manual save to API
15. Add to BRANCH_MANAGER sidebar under "Floor Plan" section

### Phase 3 — POS Table Map
16. Build `apps/pos/app/(pos)/tables/page.tsx`
17. Fetch floor plan and table statuses from API on mount
18. Render read-only canvas with React Flow (same shape components)
19. Color tables by status (green/red/orange/blue)
20. Subscribe to Socket.IO `table:status_changed` for live updates
21. Implement tap handlers: free table → new order, occupied → show popup
22. Add multi-floor tab selector
23. Replace the plain table number dropdown in new order flow with this visual map

### Phase 4 — Table List View
24. Build `/dashboard/floor-plan/tables` list page
25. Add inline edit for label, capacity, active status
26. Add bulk activate/deactivate

---

## PIN Logic Fix (separate from floor plan)

Fix the user creation logic throughout the system:

**TENANT_ADMIN:** No PIN field. Remove from seed and creation form.
**BRANCH_MANAGER:** PIN is optional. Show PIN field in creation form with
  label "POS PIN (optional — only needed if this manager uses the POS tablet)"
**CASHIER:** PIN is mandatory. Creation form must require a 4-digit PIN.
  Cannot create a cashier without a PIN.
**WAITER:** PIN is mandatory. Same as cashier.

Update POS login screen: only show staff cards for users who HAVE a posPin set.
TENANT_ADMIN accounts never appear on the POS login screen.

Update dashboard login: CASHIER and WAITER roles cannot log into the dashboard
at all. If they try, redirect to POS with message "Please use the POS terminal."

---

## Notes for Antigravity

- Use `@xyflow/react` for the canvas — do not build a custom drag-and-drop engine from scratch
- The floor plan JSON is stored in the `FloorPlan.floors` column — it is the
  single source of truth for the visual layout
- The `Table` records are derived from the floor plan — synced on every save
- Do NOT use Three.js or any 3D library — use 2.5D SVG top-down view only
- The POS table map must work offline — cache the floor plan in IndexedDB on first
  load so it works even without internet. Table statuses show as unknown when offline.
- All shape components must be in `packages/ui` so they can be shared between
  `apps/dashboard` (designer) and `apps/pos` (viewer)
- Follow design.md for all colors, typography, and spacing
