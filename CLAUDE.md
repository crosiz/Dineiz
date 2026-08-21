# Dineiz (SwiftServe) Architecture & Reference Documentation

## Tech Stack
- **Database**: NeonDB (PostgreSQL) via Prisma ORM
- **Cache/Queue**: Upstash Redis + BullMQ v5
- **Auth**: Better Auth v1
- **Real-time**: Socket.IO v4 with Redis adapter
- **Storage**: Cloudinary
- **Email**: Resend
- **Mobile**: Expo SDK 51 + Expo Router v3
- **ML**: Python FastAPI + Prophet
- **Package manager**: pnpm with Turborepo

## Domain Structure
Development:
- `dev-api.dineiz.com` → Railway (API)
- `dev-console.dineiz.com` → Vercel (dashboard)
- `dev-pos.dineiz.com` → Vercel (POS)
- `dev-admin.dineiz.com` → Vercel (super admin)

Production:
- `api.dineiz.com`
- `console.dineiz.com`
- `pos.dineiz.com`
- `admin.dineiz.com`
- `rider.dineiz.com`

## Database Models (Key ones)
Tenant, Branch (branchCode: SS-XXX-001), User (roles: TENANT_ADMIN,
BRANCH_MANAGER, CASHIER, WAITER, KITCHEN_STAFF, RIDER), Category, Item,
Variation, AddOn, Order, OrderItem, Payment, Shift, ShiftBreak, ShiftActivity,
KdsStation, Ingredient, Stock, Recipe, RecipeLine, StockMovement, PurchaseOrder,
PromoCode, Deal, Combo, Customer, LoyaltyTier, LoyaltyPointLedger, FloorPlan,
Table, TenantBranding, TenantSubscription, AuditLog, AnomalyEvent,
RiderAssignment, DeliveryZone, AggregatorWebhookEvent, ScheduledReport.

## Plans Architecture
- **GO_FREE**: PKR 0 — mobile only, 30 orders/day
- **GO_PRO**: PKR 999/month — mobile + WhatsApp bot
- **STARTER**: PKR 2,999/month — tablet POS + 1 branch + 5 staff
- **PRO**: PKR 5,999/month — 3 branches + 15 staff + full features
- **ENTERPRISE**: PKR 12,999/month — unlimited

## Seed Data (Development)
- **Tenant**: Kababjees Restaurant Group
- **Owner login**: `admin@kababjees.pk` / `Admin@123456`
- **Manager**: `manager.clifton@kababjees.pk` / `Manager@1234`
- **Cashier PINs**: 1234, 5678, 2345, 6789
- **Branch codes**: SS-KHI-001, SS-KHI-002, SS-KHI-003

## Current Status of Each Module

### WORKING (functional)
- POS login with PIN
- Order punching (menu items → cart)
- Send to kitchen
- Checkout (cash payment)
- Table map (shows tables, status colors)
- Admin login (email/password)
- Order History page (UI + data)
- Shift open/close flow
- Basic analytics KPI cards
- Menu management (CRUD)
- Branch management
- Staff management

### BROKEN / INCOMPLETE (needs fixing)
- Cart contamination: previous order items carry over to new orders
- CHARGE button stays grayed out even when cart has items
- GST tax rates from admin not applying correctly in POS checkout
- Table does not turn green/free after payment collected
- Settings do not persist after laptop sleep (localStorage stale read bug)
- Tickets screen shows "loading orders" indefinitely
- "166 min" timer bug — historical seeded orders showing as active
- Admin PIN modal is 80px wide (layout broken)
- Double navigation bar on some POS screens
- Orders Served / Total Value on POS home shows full day not shift-scoped
- Avg per order shows "1381.388" (3 decimal places, should be PKR 1,381)
- Floor plan tables invisible (dark on dark background)
- PDF receipts generate but formatting is broken, no branding
- KOT toggle in admin does not connect to POS
- Mark Ready toggle does not connect to POS
- Add items to existing table sometimes creates duplicate order
- Hold order functionality broken
- Reports section PDFs not branded
- All admin module screens (Deals, CRM, Loyalty, Analytics, Anomalies, Fleet, QR Ordering, Webhooks, Forecast) have UI but no backend wiring

### PERFORMANCE ISSUES
- Login takes 4-8 seconds (no connection pooling, cold Neon DB, N+1 queries)
- Every tab switch in dashboard triggers fresh API request
- No Redis caching on hot endpoints (menu, branding, stats)
- No database indexes on Order, User, Shift, Customer tables
- Prisma not using singleton (multiple instances in dev causing connection exhaustion)

### NOT YET BUILT
- Rider PWA (`apps/rider-web`) — screens exist but no functionality
- WhatsApp AI ordering bot backend
- JazzCash/EasyPaisa payment integration
- Foodpanda/Careem aggregator webhook processing
- Python forecast service (Prophet ML)
- Automated report scheduling and email delivery
- ZKTeco biometric attendance integration
- Super admin plan management connected to admin panel
- Mobile app (Dineiz Go) backend wiring

## Critical Architecture Decisions Made

### Currency Formatting (GLOBAL RULE)
`formatPKR(amount)` → "PKR 1,234" (whole numbers only, no decimals, no "Rs")  
`formatPKRCompact()` → "PKR 12K" or "PKR 1.2L" for charts

### Order Lifecycle (State Machine)
`PENDING` → `IN_KITCHEN` → `READY` → `COMPLETED` (the ONLY valid flow)  
`PENDING` → `CANCELLED` (if voided)  
Never skip states. Every transition logged in AuditLog.

### Shift-Based Data Scoping
"Today's" data = orders where `shiftId` links to a shift opened on today's date  
NOT calendar midnight-to-midnight. If shift opens Monday 10pm and closes Tuesday 2am, all revenue belongs to Monday.

### Socket.IO Room Structure
- `tenant:${tenantId}` — admin dashboard + all branches (settings, menu, branding)
- `branch:${branchId}` — POS tablets for specific branch (orders, tables, payments)
- `kds:${branchId}` — KDS screen only

### Settings Persistence Fix
POS reads branding from Zustand store (`useBrandingStore`), NOT from `localStorage.getItem()` directly. The store initializes from `localStorage` but is reactive — components re-render when admin emits `tenant:settings_updated`. Any component doing `JSON.parse(localStorage.getItem('pos_branding'))` is WRONG and must be changed to `useBrandingStore(s => s.branding)`.

### Cart State Rules
1. New order (no `orderId` param) → ALWAYS `clearCart()` on mount
2. Edit order (`orderId` param) → load from server, NOT from cart store
3. Held order (`heldOrderId` param) → load from IndexedDB, delete after loading
4. Cart Zustand store has NO persist middleware
5. Hold saves to IndexedDB via Dexie

### Tax System (Dual Rate)
- `cashTaxRate` (default 5%) — for cash payments
- `cardTaxRate` (default 17%) — for card, JazzCash, EasyPaisa  
Both stored in `TenantBranding`. Server recalculates on payment — never trusts client tax. Pre-payment receipt shows BOTH options. Final receipt shows only the applied rate.

### Print System Architecture
`printDocument(type, data)` in `apps/pos/lib/print.service.ts`  
Types: `KOT`, `CUSTOMER_BILL`, `PAID_RECEIPT`, `CANCELLATION_KOT`, `SHIFT_REPORT`  
When `printMode='PDF'` (dev default) → downloads PDF via jsPDF  
When `printMode='PRINTER'` → sends ESC/POS to connected printer  
KOT never shows prices. CUSTOMER_BILL shows dual tax. PAID_RECEIPT shows applied tax.

### Role-Based Routing (POS)
- `KITCHEN_STAFF` → `/pos/kds` (locked, no bottom nav)
- `WAITER` → `/pos/waiter` (limited: my tables, floor view, tickets for assigned)
- `CASHIER` → shift check → `/pos/home` (HOME, MENU, TICKETS, TABLES, STOCK)
- `BRANCH_MANAGER` → same as cashier + ADMIN tab
- `TENANT_ADMIN` → same as branch manager

### Database Connection (Critical)
`DATABASE_URL` must have `pgbouncer=true` for runtime queries  
`DIRECT_URL` used only for migrations (no pgbouncer)  
Prisma must use singleton pattern to prevent connection exhaustion in dev  
Keep-alive ping every 4 minutes to prevent Neon DB cold starts

## File Locations for Key Things

### POS
- Cart store: `apps/pos/lib/cart-store.ts`
- Branding store: `apps/pos/lib/branding-store.ts` (Zustand, no persist)
- Print service: `apps/pos/lib/print.service.ts`
- DB/IndexedDB: `apps/pos/lib/db.ts` (Dexie)
- Order screen: `apps/pos/app/(pos)/order/page.tsx`
- Table map: `apps/pos/app/(pos)/tables/page.tsx`
- Checkout: `apps/pos/components/checkout/`
- Bottom nav: `apps/pos/components/layout/BottomNav.tsx`
- KDS screen: `apps/pos/app/(pos)/kds/page.tsx`

### Dashboard
- Sidebar: `apps/dashboard/components/layout/Sidebar.tsx`
- Layout: `apps/dashboard/components/layout/DashboardLayout.tsx`
- Query client: `apps/dashboard/lib/query-client.ts`
- PDF templates: `apps/dashboard/lib/pdf/template.ts`
- Plan config: `apps/dashboard/lib/plans.ts`

### API
- Server entry: `apps/api/src/server.ts`
- Routes: `apps/api/src/routes/`
- Auth routes: `apps/api/src/routes/auth.routes.ts`
- Order routes: `apps/api/src/routes/orders.routes.ts`
- Settings routes: `apps/api/src/routes/settings.routes.ts`
- Cache service: `apps/api/src/lib/cache.ts`
- Prisma client: `packages/db/src/client.ts`

### Schema
- Prisma schema: `packages/db/prisma/schema.prisma`
- Seed file: `packages/db/prisma/seed.ts`

## Environment Variables Needed
See `apps/api/.env.development` and `apps/api/.env.production`  
Key vars: `DATABASE_URL`, `DIRECT_URL`, `REDIS_URL`, `JWT_SECRET`, `CLOUDINARY_*`, `RESEND_API_KEY`, `WHATSAPP_ACCESS_TOKEN`, `CORS_ORIGINS`, `FORECAST_SERVICE_URL`

## What To Fix First (Priority Order)
1. Database indexes (biggest impact, 5 minute fix)
2. Neon connection pooling (`pgbouncer=true` in `DATABASE_URL`)
3. Prisma singleton
4. Cart contamination bug (`clearCart` on new order mount)
5. Settings persistence (Zustand branding store)
6. Tax rate fix (read from branding, apply correctly in checkout)
7. Table status not updating after payment
8. Order stats scoped to shift not calendar day
9. Currency format (no decimals, PKR prefix everywhere)
10. PDF report branding

## Design Principles
- Light/minimal theme for dashboard (white bg, clean typography)
- Apple-level minimalism for website (white space, Inter font, no decorative elements)
- Brand color `var(--pos-primary)` / `var(--brand)` = `#FF6B35` (orange), overridable per tenant
- No emojis in admin dashboard — Lucide React icons only
- Currency: always `formatPKR()` — "PKR 1,234" never "Rs 1234.50"
- All buttons minimum 44px touch target
- Mobile-first for POS (used on tablets and phones)
