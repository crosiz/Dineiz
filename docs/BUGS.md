# SwiftServe — Bug Fix Specification
**Priority: Critical — All features below are broken or missing**
**Date: April 2026**
**Status: All 87 tasks marked complete but core functionality is non-functional**

---

## BUG 01 — Dashboard Home Page is Empty
**Severity: Critical**
**File: `apps/dashboard/app/(dashboard)/dashboard/page.tsx`**

### What is happening
The dashboard home page shows only "Welcome to SwiftServe admin. Sidebar and layout pending." — no KPI cards, no charts, no live data, nothing functional.

### What must be built
Build a complete dashboard home page with ALL of the following sections:

**Section 1 — KPI Cards Row (4 cards)**
- Today's Revenue — fetched from `GET /api/analytics/today?tenantId=X`
- Today's Orders — total order count for today
- Average Order Value — today's revenue divided by order count
- Active Orders Right Now — orders with status IN_PREPARATION or CONFIRMED

Each card shows: icon, label, value, and a percentage change vs yesterday (green arrow up or red arrow down).

**Section 2 — Revenue Chart**
- 7-day bar chart using Recharts
- X axis: last 7 days (Mon, Tue, Wed...)
- Y axis: revenue in PKR
- Data from `GET /api/analytics/revenue?days=7&tenantId=X`
- Shows today highlighted in brand color

**Section 3 — Live Orders Strip**
- Horizontally scrollable row of the last 10 active orders
- Each card shows: order number, order type badge, item count, total, status badge, time elapsed
- Status badges: PENDING (yellow), IN_KITCHEN (blue), READY (green), DISPATCHED (purple)
- Updates in real time via Socket.IO — no polling
- Clicking an order card opens order detail modal

**Section 4 — Top Items Today**
- Ranked list of top 5 selling items today
- Shows item name, quantity sold, revenue generated
- Data from `GET /api/analytics/top-items?date=today&tenantId=X`

**Section 5 — Branch Performance Table (only for TENANT_ADMIN)**
- Table with columns: Branch Name, Orders Today, Revenue Today, Status (Open/Closed)
- Data from `GET /api/analytics/branches?tenantId=X`
- Hidden for BRANCH_MANAGER role

**Section 6 — Low Stock Alerts**
- Warning cards for ingredients below threshold
- Data from `GET /api/inventory/alerts?tenantId=X`
- If no alerts, show a green "All stock levels healthy" message

**Section 7 — Recent Orders Table**
- Last 10 orders across all branches (or scoped to branch for BRANCH_MANAGER)
- Columns: Order #, Type, Items, Total, Status, Branch, Time
- Each row clickable to open order detail
- Data from `GET /api/orders?limit=10&tenantId=X`

**Role-based scoping:**
- If user role is `TENANT_ADMIN`: show all branches combined, show branch performance section
- If user role is `BRANCH_MANAGER`: filter all data by their `branchId`, hide branch performance section

---

## BUG 02 — Live Orders Page Crashes
**Severity: Critical**
**File: `apps/dashboard/app/(dashboard)/orders/live/page.tsx`**

### What is happening
Navigating to Live Orders crashes the page entirely with an unhandled error.

### What must be built
A live order monitoring page with:

1. **Real-time order board** — 4 columns in Kanban layout:
   - PENDING — orders waiting confirmation
   - IN KITCHEN — orders being prepared
   - READY — orders ready for pickup/delivery
   - DISPATCHED/COMPLETED — recently finished

2. **Each order card shows:**
   - Order number and token
   - Order type icon (dine-in table icon, takeaway bag, delivery scooter)
   - Item list summary (first 3 items then "+N more")
   - Total amount
   - Time since order was placed (live counter: "12 min ago")
   - Elapsed time warning if order is in kitchen for more than the target prep time (highlight red after 15 minutes)
   - Branch name (for multi-branch owners)

3. **Socket.IO integration:**
   - Connect to `api.swiftserve.com` socket on page mount
   - Listen for `order:created`, `order:updated`, `order:status_changed` events
   - Move cards between columns automatically when status changes
   - Play a subtle audio chime when a new order arrives
   - No manual refresh ever needed

4. **Filters bar:**
   - Filter by branch (dropdown, TENANT_ADMIN only)
   - Filter by order type (All, Dine-In, Takeaway, Delivery)
   - Filter by status
   - Search by order number or table number

5. **Error boundary:**
   - Wrap the entire page in a React error boundary so a crash in one component does not kill the whole page
   - Show a friendly error message with a "Reload" button if WebSocket fails to connect

### Root cause to fix
Check what error is thrown when the page loads. Most likely causes:
- Socket.IO client trying to connect to wrong URL (check `NEXT_PUBLIC_WS_URL` env var)
- Missing null check on order data before rendering
- Import error from a component that does not exist yet

---

## BUG 03 — Menu: Add Category/Item Modal Not Opening
**Severity: Critical**
**File: `apps/dashboard/app/(dashboard)/menu/page.tsx`**

### What is happening
Clicking "+ Add Category" or any add/edit item button does nothing — no modal opens, no navigation occurs, no console error visible to user.

### Root causes to investigate and fix
1. Check browser console for JavaScript errors when the button is clicked
2. The modal component likely has an import that fails silently — check for missing component files
3. The modal state variable (`isOpen`) may not be wired to the button's `onClick` handler
4. The API call inside the modal submit (`POST /api/menu/categories`) may be hitting the wrong URL

### What the Add Category modal must do
- Open as a slide-over panel from the right (not a popup modal — slide-over is better UX)
- Form fields: Category Name (required), Sort Order (number), Available (toggle)
- Submit calls `POST /api/menu/categories` with `{ name, sortOrder, tenantId }`
- On success: closes panel, refreshes category list, shows success toast
- On error: shows inline error message, does not close panel

### What the Add Item form must do
- Open as a full slide-over panel
- Form fields:
  - Item Name (required)
  - Category (dropdown of existing categories)
  - Base Price in PKR (required, number)
  - Description (textarea, optional — has "Generate with AI" button)
  - Available toggle
  - Image upload (Cloudinary upload directly from browser)
- Variations section: add multiple variations with name and price override
- Add-ons section: add multiple add-ons with name and additional price
- Submit calls `POST /api/menu/items`
- On success: item appears in list immediately, show success toast

### What the "Generate with AI" button must do
- Call `POST /api/menu/ai-description` with `{ itemName, categoryName }`
- API calls Anthropic Claude with prompt: "Write a 2-sentence appetizing menu description for a restaurant item called {itemName} in the {categoryName} category. Be concise and appealing."
- Response fills the description textarea
- Show loading spinner in the button while waiting

---

## BUG 04 — Menu: CSV Bulk Upload Not Working
**Severity: High**
**File: `apps/dashboard/app/(dashboard)/menu/page.tsx` — Bulk Upload tab**

### What is happening
Uploading a CSV file does nothing — no success message, no error message, no items appear.

### What must be fixed

**Frontend:**
- Show a loading state while upload is processing
- Show a progress indicator (parsing → validating → creating items)
- Show a clear success message: "47 items created successfully"
- Show a detailed error message if any rows fail: "Row 5 failed: price must be a number"
- Provide a downloadable CSV template button so users know the exact format

**Backend `POST /api/menu/bulk-upload`:**
- Accept `multipart/form-data` with a `file` field
- Parse CSV using `papaparse` — handle both comma and semicolon delimiters
- Expected CSV columns: `category_name, item_name, base_price, description, is_available`
- Validate every row before inserting anything — return all validation errors at once
- Use a database transaction — if any row fails, roll back all inserts
- Return `{ created: 47, failed: 0, errors: [] }`

**CSV template format:**
```
category_name,item_name,base_price,description,is_available
Burgers,Classic Burger,550,A juicy beef patty with fresh lettuce,true
Burgers,Cheese Burger,650,Double cheese with special sauce,true
Drinks,Cola,150,Chilled Coca-Cola,true
```

---

## BUG 05 — Branches: Add New Branch Not Working
**Severity: Critical**
**File: `apps/dashboard/app/(dashboard)/branches/page.tsx`**

### What is happening
Clicking "+ Add Branch" does nothing — no form, no modal, no navigation.

### What the Add Branch flow must do

**Step 1 — Branch basic info form:**
- Branch Name (required)
- Address (required)
- City (required)
- Phone number
- Email

**Step 2 — Operating hours:**
- For each day of week: toggle open/closed, set open time and close time
- Quick presets: "Same as Monday" button to copy hours across days

**Step 3 — Settings:**
- Currency (PKR default)
- Timezone (Asia/Karachi default)
- Tax rate percentage
- KDS enabled toggle (if on plan that includes KDS)
- KOT printer toggle

**On submit:**
- Call `POST /api/branches` with all branch data
- Check plan limit — if tenant is on Starter (max 1 branch) and already has 1, show upgrade prompt instead of creating
- On success: branch appears in list, show success toast
- On error: show specific error message

**Plan limit enforcement (critical):**
```typescript
// Before creating branch, check:
const branchCount = await prisma.branch.count({ where: { tenantId } })
const planLimit = PLAN_FEATURES[tenant.plan].max_branches
if (branchCount >= planLimit) {
  return reply.status(403).send({
    error: 'PLAN_LIMIT',
    message: `Your ${tenant.plan} plan allows ${planLimit} branch. Upgrade to add more.`
  })
}
```

**Frontend plan limit handling:**
- If API returns `PLAN_LIMIT` error, show an upgrade modal instead of an error toast
- Upgrade modal shows: current plan, branch limit, next plan with higher limit, upgrade button

---

## BUG 06 — Role-Based Dashboard Scoping Not Working
**Severity: High**

### What is happening
Both TENANT_ADMIN and BRANCH_MANAGER see the same data regardless of role. The branch scoping from the JWT token is not being applied to API queries.

### What must be fixed

**In the Fastify API middleware:**
```typescript
// Every protected route must extract role and branchId from the JWT
const { userId, tenantId, role, branchId } = req.user

// For BRANCH_MANAGER, inject branchId filter into every query
if (role === 'BRANCH_MANAGER' && !branchId) {
  return reply.status(403).send({ error: 'No branch assigned to this manager' })
}

// Pass to route handler
req.scopedBranchId = role === 'BRANCH_MANAGER' ? branchId : null
// null means "all branches" (TENANT_ADMIN), a value means "filter to this branch"
```

**In every API route that returns orders, inventory, analytics:**
```typescript
const whereClause = {
  tenantId: req.tenantId,
  ...(req.scopedBranchId && { branchId: req.scopedBranchId })
}
```

**In the dashboard frontend:**
- Read the user role from the auth session
- Hide "Branch Performance" section if role is BRANCH_MANAGER
- Hide "Add Branch" button if role is BRANCH_MANAGER
- Hide billing and subscription links if role is BRANCH_MANAGER
- The branch dropdown filter should be visible only for TENANT_ADMIN

---

## BUG 07 — Sidebar Navigation Labels Missing
**Severity: Medium**
**File: `apps/dashboard/components/sidebar.tsx`**

### What is happening
The sidebar shows only icons with no labels. Hovering does not show tooltips. Users cannot tell which icon goes where.

### What must be fixed
- Show text labels next to icons (collapsed sidebar shows icons only, expanded shows icon + label)
- Add hover tooltips showing the page name when sidebar is collapsed
- Add active state highlight for the current page
- Sidebar must expand on hover and collapse when mouse leaves
- Each nav item must have a clear label:
  - Chart icon → Dashboard
  - List icon → Orders
  - Fork icon → Menu
  - Grid icon → Branches
  - People icon → Staff
  - Box icon → Inventory
  - Tag icon → Deals
  - Person icon → CRM / Customers
  - Bar chart icon → Analytics
  - Trend icon → Reports
  - Star icon → Loyalty
  - Person circle → Profile / Settings

---

## BUG 08 — Missing API Endpoints
**Severity: Critical**

The following API endpoints are called by the frontend but either do not exist or return errors. Build all of them:

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/analytics/today` | GET | Today's KPIs for dashboard |
| `/api/analytics/revenue` | GET | Revenue chart data by date range |
| `/api/analytics/top-items` | GET | Best selling items |
| `/api/analytics/branches` | GET | Per-branch performance summary |
| `/api/menu/categories` | GET, POST, PUT, DELETE | Category CRUD |
| `/api/menu/items` | GET, POST, PUT, DELETE | Item CRUD |
| `/api/menu/bulk-upload` | POST | CSV bulk menu upload |
| `/api/menu/ai-description` | POST | Generate item description with Claude |
| `/api/branches` | GET, POST, PUT | Branch CRUD with plan limit check |
| `/api/inventory/alerts` | GET | Low stock alerts |
| `/api/orders/live` | GET | Live orders with real-time filter |

---

## BUG 09 — No Toast Notification System
**Severity: Medium**

### What is happening
No success or error toasts appear anywhere in the app. When actions succeed or fail, there is zero feedback to the user.

### What must be added
Install and configure `react-hot-toast` or `sonner` in `apps/dashboard`. Add a `<Toaster />` component to the root layout. Every API call success must show a green toast. Every API error must show a red toast with the error message. Toast must appear in top-right corner and auto-dismiss after 3 seconds.

---

## Implementation Priority Order

Fix in this exact order — each fix unblocks the next:

1. **BUG 08** — Build missing API endpoints first (everything depends on this)
2. **BUG 03** — Fix Add Category/Item (need API endpoints working first)
3. **BUG 04** — Fix CSV upload (need item API working first)
4. **BUG 05** — Fix Add Branch (need branch API working first)
5. **BUG 09** — Add toast notifications (needed for all form feedback)
6. **BUG 01** — Build dashboard home (need analytics APIs working first)
7. **BUG 02** — Fix Live Orders (need orders API and Socket.IO working)
8. **BUG 06** — Fix role scoping (need all APIs working first)
9. **BUG 07** — Fix sidebar labels (UI polish, last priority)

---

## How to Test Each Fix

After Antigravity implements each fix, test in this order:

```
1. Open http://localhost:3000
2. Login with admin@swiftserve.app / Admin1234!
3. Dashboard home — verify 4 KPI cards show (even with 0 values)
4. Click Orders → Live — verify page loads without crash
5. Click Menu → Add Category — verify slide-over opens
6. Add a category called "Test Category" — verify it appears in list
7. Add an item to that category — verify it appears
8. Upload the CSV template — verify items are created
9. Click Branches → Add Branch — verify form opens
10. Add a new branch — verify it appears in list
11. Logout and login as manager@swiftserve.app / Manager1234!
12. Verify dashboard shows only Main Branch data
13. Verify "Add Branch" button is hidden
14. Verify branch performance section is hidden
```

---

## Notes for Antigravity

- Do not rewrite working code. Only fix the specific bugs listed above.
- Every API endpoint must include proper error handling — never return 500 with stack traces.
- Every frontend form must show loading states during API calls.
- Every API error must show a user-friendly toast message, not a raw JSON error.
- The design.md file defines all colors, typography, and component styles — follow it exactly.
- Do not use `any` TypeScript type anywhere.
- All monetary values are in PKR (Pakistani Rupees) by default.
