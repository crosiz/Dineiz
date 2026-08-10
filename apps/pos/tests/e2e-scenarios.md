# POS End-to-End Test Scenarios

This document contains detailed step-by-step integration tests to verify all critical flows in the POS, Kitchen Display System (KDS), and Admin panel. These tests are manual and should be executed in a browser with the network tab open to verify API calls, alongside database checks where necessary.

---

## Test Group 1 — Authentication & Session

### Scenario 1.1: Fresh POS login
- **Precondition:** Clear localStorage/sessionStorage. Go to `/pos/login`.
- **Steps:** Select Amna Butt from staff list. Enter PIN 7890. Observe redirect and network tab.
- **Expected:** Redirect to `/pos/shift/open` because no shift is currently open. `localStorage` `pos_session` should contain `userId` and `role`. API `/api/auth/login` should return 200 OK.

### Scenario 1.2: Wrong PIN lockout
- **Precondition:** On login screen with a staff member selected.
- **Steps:** Enter wrong PIN 4 times. Observe UI. Enter wrong PIN a 5th time. Observe UI.
- **Expected:** Warning on 4th attempt. After 5th wrong attempt, PIN entry locks for 60 seconds with a visual countdown. No more digit entry accepted until timer expires.

### Scenario 1.3: Session survives page refresh
- **Precondition:** Logged in as Amna Butt with an active shift, on `/pos/home`.
- **Steps:** Press F5/Cmd+R to refresh the browser. Observe navigation and state.
- **Expected:** App restores to `/pos/home` without requiring login. `localStorage` `pos_session` and `pos_shift` remain intact.

### Scenario 1.4: Logout Flow
- **Precondition:** Logged in, on `/pos/home`.
- **Steps:** Tap user avatar/menu in top right. Tap "Logout". 
- **Expected:** Redirected to `/pos/login`. `pos_session` removed from localStorage. User cannot navigate back to `/pos/home` without logging in again.

---

## Test Group 2 — Shift Management

### Scenario 2.1: Open shift
- **Precondition:** Logged in, on `/pos/shift/open` screen.
- **Steps:** Enter opening float PKR 5000. Tap "Start Shift".
- **Expected:** Navigate to `/pos/home`. `localStorage` `pos_shift` contains `shiftId` and `openedAt`. Admin dashboard "Shift Management" shows this shift as `OPEN` with PKR 5000 opening float.

### Scenario 2.2: Attempt to close shift with open orders
- **Precondition:** Shift is open. There is at least 1 order in `IN_KITCHEN` or `READY` status.
- **Steps:** Tap avatar in top right. Tap "Close Shift".
- **Expected:** System should warn or block closing the shift, displaying "Cannot close shift with active orders" or require overriding. 

### Scenario 2.3: Close shift successfully
- **Precondition:** Shift is open, all orders are COMPLETED or CANCELLED.
- **Steps:** Tap "Close Shift". Enter closing cash in drawer (e.g., PKR 10500). Tap "Submit".
- **Expected:** Navigate to `/pos/login`. `pos_shift` removed from localStorage. Admin panel shows shift as `CLOSED`. Expected cash and actual cash variance is calculated correctly in the database (`Shift` record).

---

## Test Group 3 — Dine-In Order Flow

### Scenario 3.1: New dine-in order end-to-end
- **Precondition:** Shift open, logged in, at `/pos/home`.
- **Steps:** Tap "New Order". Table map opens. Tap a green (free) table (e.g., T-1). Order screen opens with T-1 in top bar. Tap "Chicken Karahi" and "Naan". 
- **Expected:** Cart shows 2 items with correct subtotal and taxes. 
- **Steps (Cont):** Tap "KITCHEN". 
- **Expected:** Success toast appears. Table T-1 turns red (occupied) on `/pos/tables`. Tickets screen shows order as `IN_KITCHEN`. Admin dashboard Live Orders shows order.

### Scenario 3.2: Modifying an existing un-paid order
- **Precondition:** Table T-1 has an active order in `IN_KITCHEN` status.
- **Steps:** Go to `/pos/tables`. Tap Table T-1. Tap "Add Items". Add "Coke". Tap "KITCHEN".
- **Expected:** Success toast. The new item is added to the existing order ticket (or a new sub-ticket is generated). Total price updates accordingly.

### Scenario 3.3: Kitchen processing & KDS sync
- **Precondition:** Order from 3.1 is `IN_KITCHEN`. Admin KDS open in another tab.
- **Steps:** On Admin KDS, locate the order ticket. Tap "Mark as Ready". 
- **Expected:** Ticket on KDS moves to Ready/Completed. On POS `/pos/tickets`, the order status updates to `READY` in real-time.

### Scenario 3.4: Collect payment for dine-in order
- **Precondition:** Order is `READY`.
- **Steps:** In `/pos/tickets`, tap "Collect Payment" on the order. Checkout modal opens. Select "Cash", enter exact amount. Tap "Confirm Payment".
- **Expected:** Receipt screen appears (option to print). Table T-1 becomes dirty (yellow) or free (green) depending on settings. Order moves to `COMPLETED` on Admin dashboard.

---

## Test Group 4 — Takeaway & Delivery Order Flow

### Scenario 4.1: Takeaway order & Kitchen Flow
- **Precondition:** Shift open, at `/pos/home`.
- **Steps:** Tap "Takeaway Order". Enter customer name "Ahmed" and phone "03001234567". Add items. Tap "KITCHEN".
- **Expected:** Order created with a Token Number (e.g., A-101). Shows in `/pos/tickets` as Takeaway. 
- **Steps (Cont):** Mark as Ready in KDS. Pay via exact cash.
- **Expected:** Order completes. Token is freed.

### Scenario 4.2: Delivery order creation
- **Precondition:** Shift open, at `/pos/home`.
- **Steps:** Tap "Delivery Order". Enter customer name, phone, and address. Add items. Tap "KITCHEN".
- **Expected:** Order created as Delivery. Admin panel Live Orders shows delivery address. (If rider assignment is supported, verify it can be assigned).

---

## Test Group 5 — Cart Management, Discounts & Voids

### Scenario 5.1: Removing items before sending to kitchen
- **Precondition:** On order screen, items in cart, but NOT sent to kitchen yet.
- **Steps:** Swipe left on an item or tap the "X" / "-" button to remove it.
- **Expected:** Item disappears from cart. Subtotal, tax, and total update immediately.

### Scenario 5.2: Voiding an item after sent to kitchen
- **Precondition:** Order sent to kitchen. Back on order screen editing the same ticket.
- **Steps:** Attempt to remove an item already sent to the kitchen.
- **Expected:** System should prompt for Void Reason (e.g., "Customer changed mind", "Out of stock") and optionally require Admin PIN. Kitchen KDS should show a Void/Cancel notification for that item.

### Scenario 5.3: Applying an order-level discount
- **Precondition:** On order screen with items in cart.
- **Steps:** Tap "Discount". Enter 10%. 
- **Expected:** Total is reduced by 10%. Discount row appears in cart breakdown.
- **Steps (Cont):** Change to fixed amount discount (PKR 100).
- **Expected:** Total is reduced by exactly PKR 100.

### Scenario 5.4: Canceling an entire order
- **Precondition:** Active order exists in `IN_KITCHEN` status.
- **Steps:** In tickets view, tap "Cancel Order". Provide reason "Customer walked out".
- **Expected:** Order status changes to `CANCELLED`. Table is freed immediately. Order disappears from active KDS and Live Orders, moves to Order History as Cancelled.

---

## Test Group 6 — Payment Methods & Split Payments

### Scenario 6.1: Cash payment with change
- **Steps:** Open checkout with order total PKR 1053. Enter cash PKR 2000. Verify change shows PKR 947. Tap "Confirm Payment".
- **Expected:** Order marked `COMPLETED`.

### Scenario 6.2: Exact cash payment
- **Steps:** Open checkout. Tap "Exact" preset. Cash received fills to PKR 1053. Change shows PKR 0. Tap "Confirm Payment".
- **Expected:** Order marked `COMPLETED`.

### Scenario 6.3: Cash insufficient
- **Steps:** Open checkout with order PKR 1053. Enter PKR 500.
- **Expected:** Confirm button disabled. "Insufficient amount" warning visible.

### Scenario 6.4: Split Payment (Cash + Card)
- **Steps:** Open checkout for PKR 2000 order. Select "Split Payment". Enter PKR 1000 Cash, PKR 1000 Card. Tap "Confirm Payment".
- **Expected:** Payment succeeds. Database Order record shows two distinct Payment records (one Cash, one Card).

### Scenario 6.5: Card Payment
- **Steps:** Open checkout. Select "Card". (If integrated terminal: verify terminal wakes up. If manual: enter auth code optionally). Tap "Confirm Payment".
- **Expected:** Order marked `COMPLETED`. Card payment logged.

---

## Test Group 7 — Real-Time Sync POS to Admin

### Scenario 7.1: Order appears on admin dashboard in real-time
- **Precondition:** Admin Live Orders open in Tab 1. POS open in Tab 2.
- **Steps:** On POS, tap "KITCHEN". Within 2-3 seconds, check Admin tab.
- **Expected:** Order appears on Admin Live Orders via WebSockets/SSE without refreshing the page.

### Scenario 7.2: Menu change reflects on POS
- **Precondition:** Admin Menu Management and POS both open.
- **Steps:** On Admin, toggle "Chicken Tikka" availability to OFF. On POS, look at menu grid.
- **Expected:** Within 5 seconds, "Chicken Tikka" grays out or shows "SOLD OUT" on POS.

### Scenario 7.3: Branding change reflects on POS
- **Precondition:** Admin Branding Settings and POS both open.
- **Steps:** Change primary color to Blue (`#2563EB`) on Admin. Save.
- **Expected:** Within 5 seconds, POS theme colors update to Blue without page refresh.

---

## Test Group 8 — Offline Mode & Resilience

### Scenario 8.1: Create order while offline & auto-sync
- **Precondition:** Shift open, items in cart.
- **Steps:** Open DevTools → Network → Offline. Tap "KITCHEN".
- **Expected:** Red "Offline" banner appears. Toast shows "Order saved locally". Ticket shows "Pending Sync" icon. 
- **Steps (Cont):** Turn network back Online. Wait 10 seconds.
- **Expected:** Sync banner appears temporarily. Order syncs to backend. "Pending Sync" icon disappears. Order appears in Admin Live Orders.

---

## Test Group 9 — Multi-Staff & Device Synchronization

### Scenario 9.1: Shared order visibility across devices
- **Precondition:** POS open on Device A (Amna) and Device B (Hamza).
- **Steps:** On Device A, create order for Table T-3. Check Device B's `/pos/tables` and `/pos/tickets`.
- **Expected:** Device B sees Table T-3 turn red in real-time. Device B sees the order in tickets.
- **Steps (Cont):** Device B filters by "My Orders Only".
- **Expected:** Amna's order disappears from Hamza's view.

### Scenario 9.2: Conflict prevention (Double Booking)
- **Precondition:** Device A and Device B both looking at Table T-5 (currently free).
- **Steps:** Device A taps T-5 and adds items. At the same time, Device B taps T-5.
- **Expected:** Device B receives a warning "Table T-5 is currently being edited by Amna" or is blocked from opening the table until Device A saves or cancels. (Verify concurrency handling).

---

## Test Group 10 — Receipt Printing & Peripherals

### Scenario 10.1: Print final receipt
- **Precondition:** Order is on checkout screen, payment confirmed.
- **Steps:** Tap "Print Receipt" on the success modal.
- **Expected:** Browser print dialog opens (or direct IP print occurs) formatted for 80mm thermal printer. All items, taxes, totals, and business branding are present.

### Scenario 10.2: Auto-print KOT (Kitchen Order Ticket)
- **Precondition:** POS configured to auto-print KOTs.
- **Steps:** Create order, tap "KITCHEN".
- **Expected:** KOT is automatically sent to the configured kitchen printer without prompting the cashier.
