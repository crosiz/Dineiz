# Dineiz Integration Test Protocol

Run this protocol systematically before any deployment to verify every integration point in the Dineiz system.

## Environment Setup
Open three browser windows:
1. **Window 1**: Admin dashboard (`console.dineiz.pk` or `localhost:3000`)
2. **Window 2**: POS (`pos.dineiz.pk` or `localhost:3001`)
3. **Window 3**: Browser DevTools Network tab (attach to Window 2)

**For each test**: perform the action, observe the result in all windows, and note `PASS` or `FAIL`.

---

## BLOCK 1 — Settings Sync (10 minutes)

### Test 1.1 — KOT toggle
- **Action**: Admin → Settings → Branding → Enable KOT auto-print. On POS, create an order, tap KITCHEN.
- **Expected**: PDF downloads immediately. POS console shows no errors. Admin audit log shows `KOT_PRINTED` event.
- **Result**: [ ] PASS / [ ] FAIL
- **Action**: Disable KOT. Repeat the process.
- **Expected**: No PDF, no download.
- **Result**: [ ] PASS / [ ] FAIL

### Test 1.2 — Tax rate
- **Action**: Admin → Branding → Set Cash Tax Rate to 7%. Open POS checkout → select Cash tab.
- **Expected**: Tax shows 7% of subtotal.
- **Action**: Change to Card.
- **Expected**: Card tax rate applies.
- **Result**: [ ] PASS / [ ] FAIL

### Test 1.3 — Payment methods
- **Action**: Admin → Branding → Disable JazzCash. Open POS checkout.
- **Expected**: JazzCash tab is hidden.
- **Action**: Enable JazzCash.
- **Expected**: Tab reappears within 5 seconds without page refresh.
- **Result**: [ ] PASS / [ ] FAIL

### Test 1.4 — Settings persistence after sleep
- **Action**: Set a setting in admin. Close laptop lid, wait 30 seconds, open lid. On POS (without refreshing): verify setting is still applied. (This verifies the Zustand fix.)
- **Expected**: Setting remains applied.
- **Result**: [ ] PASS / [ ] FAIL

---

## BLOCK 2 — Order Lifecycle (20 minutes)

### Test 2.1 — Cart isolation
- **Action**: Create order A with 2 items. DO NOT send to kitchen. Navigate to Home. Tap New Order.
- **Expected**: Cart is completely empty.
- **Result**: [ ] PASS / [ ] FAIL

### Test 2.2 — Hold order
- **Action**: Create order with 3 items. Tap Hold.
- **Expected**: Cart clears, toast says "Order held".
- **Action**: Go to Tickets → On Hold tab. Tap the held order.
- **Expected**: Exactly the same 3 items load into the cart.
- **Result**: [ ] PASS / [ ] FAIL

### Test 2.3 — Add items to existing table
- **Action**: Open occupied table T-3. Tap Add Items. Add 2 new items. Tap Kitchen. Admin dashboard Live Orders → click the order.
- **Expected**: Admin shows all items (original + new). Order number is the SAME, not a new one.
- **Result**: [ ] PASS / [ ] FAIL

### Test 2.4 — Item removal (pre-kitchen)
- **Action**: Add item to cart. Remove it.
- **Expected**: Removed immediately, no prompt.
- **Result**: [ ] PASS / [ ] FAIL

### Test 2.5 — Item removal (post-kitchen)
- **Action**: Send order to kitchen. Reopen via Add Items. Try to remove a sent item.
- **Expected**: Bottom sheet appears asking for a reason.
- **Action**: Fill reason.
- **Expected**: Cancellation KOT PDF downloads. Admin audit log shows `ITEM_VOIDED`.
- **Result**: [ ] PASS / [ ] FAIL

---

## BLOCK 3 — Payment and Receipt (15 minutes)

### Test 3.1 — Cash payment
- **Action**: Complete a cash payment.
- **Expected**: Receipt PDF downloads automatically if autoprint is ON. Receipt shows correct items, subtotal, cash GST rate, total, cash received, change. Payment method says "Cash". Status says "PAID".
- **Result**: [ ] PASS / [ ] FAIL

### Test 3.2 — Card payment
- **Action**: Complete a card payment.
- **Expected**: Receipt shows card GST rate (higher than cash). Payment method says "Card".
- **Result**: [ ] PASS / [ ] FAIL

### Test 3.3 — Bill print before payment
- **Action**: Open occupied table popup. Tap Print Bill.
- **Expected**: PDF downloads showing BOTH cash and card option totals. Header says "CUSTOMER BILL - NOT A RECEIPT".
- **Result**: [ ] PASS / [ ] FAIL

### Test 3.4 — Receipt from ticket
- **Action**: Go to Tickets screen. Find a completed order. Tap the receipt icon.
- **Expected**: Final paid receipt PDF downloads (not the quotation bill).
- **Result**: [ ] PASS / [ ] FAIL

### Test 3.5 — Print from order detail
- **Action**: Admin dashboard → Order History → click any completed order. In the detail panel, toggle between "Customer Bill" and "Paid Receipt" views. Tap Download.
- **Expected**: Correct PDF for the selected view downloads. Both PDFs have Dineiz branding, restaurant name, and correct data.
- **Result**: [ ] PASS / [ ] FAIL

---

## BLOCK 4 — Admin-POS Real-time Sync (10 minutes)
*(All tests require both admin and POS open simultaneously)*

### Test 4.1
- **Action**: Create order on POS.
- **Expected**: Admin Live Orders shows it within 3 seconds.
- **Result**: [ ] PASS / [ ] FAIL

### Test 4.2
- **Action**: Mark order ready on Admin KDS.
- **Expected**: POS Tickets card updates to READY within 3 seconds.
- **Result**: [ ] PASS / [ ] FAIL

### Test 4.3
- **Action**: Complete payment on POS.
- **Expected**: Admin Order History shows the order within 5 seconds.
- **Result**: [ ] PASS / [ ] FAIL

### Test 4.4
- **Action**: Toggle menu item unavailable on Admin.
- **Expected**: POS shows SOLD OUT on that item within 5 seconds.
- **Result**: [ ] PASS / [ ] FAIL

### Test 4.5
- **Action**: Change brand color on Admin.
- **Expected**: POS primary color changes within 5 seconds.
- **Result**: [ ] PASS / [ ] FAIL

### Test 4.6
- **Action**: Collect payment on POS.
- **Expected**: Table map on Admin Dashboard shows table as dirty within 5 seconds.
- **Result**: [ ] PASS / [ ] FAIL

---

## BLOCK 5 — Shift and Stats (10 minutes)

### Test 5.1
- **Action**: Open shift. Make 3 orders. Complete 2, leave 1 pending. Check POS home stats.
- **Expected**: Shows 2 orders served (only completed), correct total, correct average.
- **Result**: [ ] PASS / [ ] FAIL

### Test 5.2
- **Action**: Close shift. Admin Shift Management → find the shift.
- **Expected**: Shows correct totals matching the 2 completed orders.
- **Result**: [ ] PASS / [ ] FAIL

### Test 5.3
- **Action**: Try to close shift with 1 pending order.
- **Expected**: Blocked with clear error showing the pending order.
- **Result**: [ ] PASS / [ ] FAIL

### Test 5.4
- **Action**: Generate shift report PDF.
- **Expected**: PDF opens with restaurant branding, all financial data correct, no empty sections, no broken formatting.
- **Result**: [ ] PASS / [ ] FAIL

---

## BLOCK 6 — Role Permissions (10 minutes)

### Test 6.1
- **Action**: Log in as `KITCHEN_STAFF`.
- **Expected**: Goes directly to KDS, no bottom nav, cannot navigate anywhere else.
- **Result**: [ ] PASS / [ ] FAIL

### Test 6.2
- **Action**: Log in as `WAITER`.
- **Expected**: Sees waiter home with assigned tables only. Cannot access ADMIN tab.
- **Result**: [ ] PASS / [ ] FAIL

### Test 6.3
- **Action**: Log in as `CASHIER`. Apply 15% discount when limit is 10%.
- **Expected**: Manager PIN prompt appears.
- **Result**: [ ] PASS / [ ] FAIL

### Test 6.4
- **Action**: Log in as `BRANCH_MANAGER`.
- **Expected**: Sees ADMIN tab. ADMIN panel shows all active shifts for this branch only.
- **Result**: [ ] PASS / [ ] FAIL

---

## BLOCK 7 — Reports (5 minutes)

### Test 7.1
- **Action**: Generate Daily Sales Report.
- **Expected**: PDF downloads with correct date, branch, revenue total, payment method breakdown. All numbers match what you see in the dashboard.
- **Result**: [ ] PASS / [ ] FAIL

### Test 7.2
- **Action**: Generate Tax Report.
- **Expected**: Shows separate cash GST total and card GST total.
- **Result**: [ ] PASS / [ ] FAIL

### Test 7.3
- **Action**: Generate Menu Performance Report.
- **Expected**: Shows items sorted by revenue, correct quantities.
- **Result**: [ ] PASS / [ ] FAIL

---

## BLOCK 8 — Settings Persistence (5 minutes)
*(These tests specifically check that settings do not reset.)*

### Test 8.1
- **Action**: Enable PDF download in admin settings. Refresh the POS page. Create order and pay.
- **Expected**: PDF still downloads (setting persisted).
- **Result**: [ ] PASS / [ ] FAIL

### Test 8.2
- **Action**: Set brand color to blue. Close and reopen the POS browser tab.
- **Expected**: POS still shows blue theme.
- **Result**: [ ] PASS / [ ] FAIL

### Test 8.3
- **Action**: Set cash tax to 7%. Close admin tab and reopen.
- **Expected**: Cash tax is still 7%.
- **Result**: [ ] PASS / [ ] FAIL

---

## FAILURE RESPONSE GUIDE

If any test fails, the failure points to a specific integration layer:

*   **Settings tests fail** → Check the Zustand branding store fix (Prompt 1). Check that `tenant:settings_updated` is being emitted by the API after every settings save.
*   **Order lifecycle tests fail** → Check the cart store has no `persist` middleware. Check the `sourceOrderId` is being validated correctly.
*   **Real-time sync tests fail** → Check Socket.IO room names match exactly between emitter and subscriber. Check that the Socket.IO server is using the Redis adapter for multi-process support.
*   **Receipt/PDF tests fail** → Check the `createBrandedPDF` template function is being called correctly. Check that all required data fields are being passed to the generator.
*   **Shift tests fail** → Check the shift-scoped query uses `shiftId` not date range.
*   **Role permission tests fail** → Check the navigation guard runs on every pathname change, not just on first mount.

*Run all 40 tests. Fix any failures. When all 40 pass, the application is ready for production.*
