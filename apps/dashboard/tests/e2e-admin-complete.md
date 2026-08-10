# Comprehensive End-to-End Admin Checklist

This document is a human-run checklist covering every screen, every role, and every integration point between the admin panel and the POS.

## SECTION 1 — Authentication and Role-Based Access

**Test 1.1 — Business Owner first login:**
- **Precondition:** A new tenant has been created with owner email admin@kababjees.pk and password Admin@123456.
- **Steps:** Go to console.dineiz.com/login. Enter the credentials. Tap Sign In. Observe the sidebar.
- **Expected:** Login succeeds. Dashboard home page loads. Sidebar shows ALL sections including Overview, Operations, Business, Growth, Analytics, Integrations, and Settings. The header shows "Enterprise Management" badge. The branch selector dropdown in the top right shows all branches.

**Test 1.2 — Branch Manager login (created by owner):**
- **Precondition:** Owner has created a manager account for manager.gulshan@kababjees.pk with role BRANCH_MANAGER assigned to Gulshan-e-Iqbal branch.
- **Steps:** Log out as owner. Log in as manager.gulshan@kababjees.pk.
- **Expected:** Login succeeds. Sidebar shows ONLY the branch-scoped sections: My Branch Dashboard, Live Orders, Order History, Shift Management, KDS Screen, Floor Plan, Menu Availability, Inventory, Staff on Shift, Today's Report. Sections NOT visible: Branches (multi-branch management), cross-branch Analytics, CRM, Deals, Loyalty, Aggregators, Fleet, Webhooks, Branding, Billing, QR Ordering, Forecast, Anomalies. The branch selector in the top right shows only Gulshan-e-Iqbal as static text, not a dropdown.

**Test 1.3 — Owner creates a Branch Manager:**
- **Precondition:** Logged in as business owner.
- **Steps:** Navigate to Business → Staff and Roles. Tap Add Staff Member. Fill in name "Zain Manager", email "zain@kababjees.pk", phone "+923001111111". Set role to BRANCH_MANAGER. Select branch Gulshan-e-Iqbal. Set a temporary password. Tap Save. Open a new incognito browser window. Go to the login page. Log in as zain@kababjees.pk with the temporary password.
- **Expected:** Manager can log in. Dashboard shows only branch-scoped sidebar. Cannot access Billing, Branding, or other owner-only sections. Attempting to navigate directly to /dashboard/billing redirects to /dashboard or shows an access denied page.

**Test 1.4 — Session persistence across browser refresh:**
- **Steps:** Log in as owner. Press F5.
- **Expected:** Dashboard reloads to the same page. No redirect to login. Session remains valid.

**Test 1.5 — Session expiry handling:**
- **Steps:** Log in. Open browser DevTools → Application → Local Storage or Cookies. Manually delete the session token or cookie. Refresh the page.
- **Expected:** Redirected to login page with a "Session expired" or equivalent message. No white screen or crash.

## SECTION 2 — Dashboard Home Page

**Test 2.1 — KPI cards show real data:**
- **Precondition:** At least 5 orders were completed today via the POS.
- **Steps:** Log in as owner. View the dashboard home page KPI cards.
- **Expected:** Total Revenue card shows the sum of today's completed orders. Active Orders card shows the current count of PENDING plus IN_KITCHEN plus READY orders. Orders Today shows total orders created today regardless of status. Average Order Value shows the mean of today's completed order totals. None of these show 0 when data exists.

**Test 2.2 — Revenue chart reflects real orders:**
- **Steps:** View the revenue chart on the dashboard home page.
- **Expected:** The chart shows data points corresponding to actual order amounts at their correct times. If you placed 3 orders at 2pm, 4pm, and 6pm the chart shows activity at those times.

**Test 2.3 — Recent orders section:**
- **Steps:** Check the Recent Orders section on the home page.
- **Expected:** Shows the last 5 orders with correct order numbers, branch names, amounts, and status badges. Clicking any order navigates to Order History with that order highlighted or its detail open.

**Test 2.4 — Live order count updates in real time:**
- **Precondition:** Admin dashboard home page is open. POS is open in another window.
- **Steps:** On the POS, create a new order and send to kitchen.
- **Expected:** Within 5 seconds the Active Orders count on the admin dashboard home page increments by 1 without page refresh.

**Test 2.5 — Branch performance section (owner view):**
- **Precondition:** Multiple branches with orders.
- **Steps:** View the Branch Performance section.
- **Expected:** Each active branch shows its individual revenue, order count, and a percentage comparison vs the previous period. Clicking a branch card navigates to that branch's specific view.

## SECTION 3 — Live Orders

**Test 3.1 — Orders appear in correct kanban columns:**
- **Precondition:** Create orders in different states on the POS.
- **Steps:** Create one order and do not send to kitchen (PENDING). Create another and send to kitchen (IN_KITCHEN). Mark a third as ready on KDS (READY). Go to admin Live Orders.
- **Expected:** Three kanban columns visible: PENDING, IN KITCHEN, READY, COMPLETED. Each order appears in the correct column. Timers on each card count upward from order creation time. No negative timers.

**Test 3.2 — Real-time kanban updates:**
- **Steps:** Admin Live Orders is open. On POS, send an order to kitchen.
- **Expected:** The order card moves from PENDING column to IN KITCHEN column on the admin dashboard without page refresh. The movement should be smooth — card disappears from one column and appears in the other.

**Test 3.3 — Mark Ready from admin dashboard:**
- **Steps:** Find an IN_KITCHEN order card. Click the Mark Ready button on the card.
- **Expected:** Card moves to READY column. On the POS Tickets screen the same order updates to READY status within 5 seconds. On the KDS screen the order shows as ready.

**Test 3.4 — Live Orders date filter (no historical orders):**
- **Steps:** Open Live Orders.
- **Expected:** Zero orders from yesterday or earlier are visible. All visible orders were created today after midnight. The seeded historical data does not appear.

**Test 3.5 — Sound alert toggle:**
- **Steps:** Toggle the SOUND ON/OFF switch at the top of Live Orders.
- **Expected:** When SOUND is ON and a new order arrives, a notification chime plays. When SOUND is OFF no sound plays. The setting persists after page refresh.

**Test 3.6 — Fullscreen mode:**
- **Steps:** Click the fullscreen expand button on the Live Orders page.
- **Expected:** The page enters true browser fullscreen mode (F11 equivalent). The exit fullscreen button or pressing Escape exits fullscreen.

## SECTION 4 — Order History

**Test 4.1 — Filters work correctly:**
- **Steps:** Use the date filter to select Yesterday. Use the Type filter to select Dine-In. Use the Status filter to select Completed. Use the Payment filter to select Cash.
- **Expected:** Only orders matching ALL selected filters appear. The result count updates to reflect the filtered set. Clearing any filter restores the broader result set.

**Test 4.2 — Export Excel:**
- **Steps:** Apply any filter. Click Export Excel.
- **Expected:** A download starts immediately. The file is a valid Excel document. It contains three sheets: Orders Summary, Order Items, and Payment Details. The data matches what is shown in the filtered table.

**Test 4.3 — Order detail slide-over:**
- **Steps:** Click any order number in the table.
- **Expected:** A slide-over panel opens from the right showing: full order details, all items with quantities and prices, tax breakdown, payment method, cashier name, table number, timestamps. The slide-over must close when clicking outside it or pressing Escape.

**Test 4.4 — Cashier filter works:**
- **Steps:** In the Order History filters, select a specific cashier from the Cashier dropdown.
- **Expected:** Only orders processed by that cashier appear. The count reduces accordingly.

## SECTION 5 — Menu Management

**Test 5.1 — Add new menu item and verify on POS:**
- **Steps:** Navigate to Menu. Tap Add Item. Fill in name "Test Chapli Kabab", category Kababs and BBQ, price 750, description optional. Set available to true. Save. On the POS, navigate to the order screen. Look for Test Chapli Kabab.
- **Expected:** The item appears on the POS within 10 seconds without the cashier refreshing. It appears in the Kababs and BBQ category with correct price.

**Test 5.2 — Toggle item unavailability and verify on POS:**
- **Steps:** On admin Menu, find Chicken Tikka. Toggle its availability off. Check the POS order screen.
- **Expected:** Within 10 seconds Chicken Tikka shows a SOLD OUT overlay on the POS and cannot be tapped. If a cashier already has it in their cart when it goes unavailable, the cart item should show a warning indicator but not be removed automatically.

**Test 5.3 — Change item price and verify on POS:**
- **Steps:** On admin Menu, find Seekh Kabab. Change its price from 650 to 750. Save. Check the POS.
- **Expected:** Within 10 seconds the POS shows the new price 750 on the Seekh Kabab card.

**Test 5.4 — Add a variation and verify on POS:**
- **Steps:** On admin Menu, find Mutton Karahi. Add a new variation named "Half" with price 1800. Save. On POS tap Mutton Karahi.
- **Expected:** The variation picker opens showing at least two options: Full (original) and Half (1800). Selecting Half adds the item at 1800.

**Test 5.5 — Publish menu changes:**
- **Steps:** Make multiple changes to the menu without saving. Then click Publish Changes.
- **Expected:** All changes save simultaneously. The POS receives a single menu:published Socket.IO event and refreshes once. Not multiple individual events per change.

**Test 5.6 — AI description generation:**
- **Steps:** Add a new item named "Peshawari Chapli Kabab". Click the AI description button if available.
- **Expected:** A relevant description generates automatically using the item name as context. The description can be edited before saving.

## SECTION 6 — Branches

**Test 6.1 — Branch codes are visible and copyable:**
- **Steps:** Navigate to Business → Branches.
- **Expected:** Each branch card shows its POS Code (format SS-XXX-001). There is a copy button next to the code. Clicking copy puts the code in clipboard and shows a "Copied!" toast.

**Test 6.2 — Add new branch:**
- **Steps:** Click Add Branch. Fill in name "North Nazimabad", address, city Karachi, phone. Set opening hours 12:00 to 23:00. Assign a color. Save.
- **Expected:** New branch card appears in the list. The branch is assigned a unique branch code. Navigating to the POS login and entering this new branch code shows the new branch name.

**Test 6.3 — Edit branch:**
- **Steps:** On any branch card, click the edit (pencil) icon. Change the opening time from 09:00 to 10:00. Save.
- **Expected:** Branch card updates to show new opening time. The POS for that branch reflects the updated schedule.

**Test 6.4 — Toggle branch active/inactive:**
- **Steps:** On the three-dot menu of any active branch, click Mark Inactive.
- **Expected:** Branch card shows INACTIVE badge. Branch color dims. The branch no longer appears in the branch selector dropdown for new logins on the POS. Existing POS sessions for that branch can still complete current orders but cannot start new shifts.

**Test 6.5 — Revenue shows real data per branch:**
- **Precondition:** Orders placed for specific branches.
- **Expected:** TODAY'S REVENUE on each branch card reflects only that branch's completed orders for today.

## SECTION 7 — Staff and Roles

**Test 7.1 — Owner creates a cashier with PIN:**
- **Steps:** Navigate to Business → Staff and Roles. Click Add Staff Member. Enter name "Test Cashier", select role Cashier, select branch Gulshan-e-Iqbal, enter PIN 9999. Save.
- **Expected:** Staff member appears in the list. On the POS login screen the new staff member's card appears. Entering PIN 9999 logs them in.

**Test 7.2 — Owner creates a non-POS staff member (WORKER):**
- **Steps:** Add Staff Member. Enter name "Hassan Cleaner", select role WORKER (or General Staff). Select branch. Note that email and PIN fields should be hidden or optional for this role.
- **Expected:** Staff member created without PIN. They do not appear on the POS login screen (only POS-enabled roles appear). They appear in the staff list with an Attendance Only badge.

**Test 7.3 — Reset PIN:**
- **Steps:** On any cashier's three-dot menu, select Reset PIN. Enter new PIN 8888.
- **Expected:** The old PIN 9999 no longer works on the POS. The new PIN 8888 logs the cashier in successfully.

**Test 7.4 — Deactivate a staff member:**
- **Steps:** On any cashier's three-dot menu, select Deactivate.
- **Expected:** Staff member shows INACTIVE status. On the POS login screen that staff member's card no longer appears. If they were already logged in, their current session continues until they manually log out or their token expires.

**Test 7.5 — ZKTeco enrollment indicator:**
- **Steps:** View the staff list.
- **Expected:** A Biometric column shows Enrolled in green with fingerprint icon for enrolled staff, or Not Enrolled in gray for others. Clicking Not Enrolled opens an enrollment dialog asking which ZKTeco device to enroll on.

## SECTION 8 — Floor Plan Editor

**Test 8.1 — Save floor plan and verify on POS:**
- **Steps:** Navigate to Operations → Floor Plans. Select a branch. Add a new table using the TABLE tool. Position it on the canvas. Assign it label T-11 and capacity 4. Save Floor Plan.
- **Expected:** On the POS Table Map, the new table T-11 appears in its correct position. The table is green (free) and shows 4 seats.

**Test 8.2 — Delete a table and verify on POS:**
- **Steps:** In Floor Plan Editor, select table T-11 (from Test 8.1). Delete it. Save.
- **Expected:** T-11 disappears from the POS Table Map within 10 seconds. Any existing orders for T-11 remain in the database but the table is no longer visible for new orders.

**Test 8.3 — Add a zone:**
- **Steps:** Use the ZONE tool to draw a boundary around tables T-1 through T-5. Label the zone "Indoor". Save.
- **Expected:** On POS Table Map, a labeled zone border appears around those tables.

**Test 8.4 — Multi-floor setup:**
- **Steps:** Click the floor selector dropdown. Click Add Floor. Name it "First Floor". Add tables T-7, T-8, T-9 on this floor. Save.
- **Expected:** POS Table Map shows two floor tabs. Clicking each tab shows only that floor's tables. The table count in the header updates per floor.

## SECTION 9 — KDS Monitor

**Test 9.1 — KDS shows correct orders:**
- **Precondition:** Several IN_KITCHEN orders from today.
- **Steps:** Navigate to Operations → KDS Monitor.
- **Expected:** Full dark screen showing order cards. Only today's IN_KITCHEN and READY orders are visible. Timers count upward from order creation. No orders older than today appear.

**Test 9.2 — Mark order ready from KDS:**
- **Steps:** Find any IN_KITCHEN order card. Click Mark All Ready.
- **Expected:** The order card moves off the KDS screen (or changes to a completed state). On the POS Tickets screen the order status changes to READY. On admin Live Orders the card moves to the READY column.

**Test 9.3 — KDS station routing:**
- **Precondition:** KDS stations are configured (Grill Station, Main Kitchen, Drinks and Desserts).
- **Steps:** Click the Grill Station tab on the KDS.
- **Expected:** Only orders containing items routed to the Grill Station appear. The count badge on the tab shows the correct number.

**Test 9.4 — KDS fullscreen:**
- **Steps:** Click the fullscreen button on KDS.
- **Expected:** KDS enters fullscreen. This is designed to run on a dedicated kitchen tablet or screen. Pressing Escape exits fullscreen.

## SECTION 10 — Inventory

**Test 10.1 — Stock levels display:**
- **Steps:** Navigate to Business → Inventory → Stock Levels tab.
- **Expected:** Ingredients list with current quantities. Any ingredient below its reorder level shows a LOW STOCK warning in red or yellow.

**Test 10.2 — Create purchase order:**
- **Steps:** Go to Purchase Orders tab. Click Create Purchase Order. Select supplier, add ingredients with quantities and costs. Save as Draft.
- **Expected:** PO appears in the list with DRAFT status. Receiving the PO updates stock levels accordingly.

**Test 10.3 — Automatic stock deduction after order completion:**
- **Precondition:** Chicken Tikka has a recipe with 200g chicken breast per serving. Chicken breast has stock 5000g.
- **Steps:** On POS, complete a payment for an order containing 2x Chicken Tikka.
- **Expected:** In admin Inventory → Stock Levels, Chicken Breast quantity reduces by 400g (200g × 2) automatically.

## SECTION 11 — Branding Settings and POS Color Sync

**Test 11.1 — Change primary color and verify on POS:**
- **Steps:** Navigate to Settings → Branding. Change Primary Color from #FF5722 orange to #2563EB blue. Click Save All Changes.
- **Expected:** On the admin panel itself, any orange elements do not change (admin uses fixed branding). On the POS app within 10 seconds: all orange buttons, active tab indicators, category pill borders, the New Order card background, price text, the Collect Payment button, and all other primary-colored elements turn blue. No page refresh required on the POS.

**Test 11.2 — Change restaurant name and verify on POS:**
- **Steps:** On Branding page, change Restaurant Name from "Kababjees Restaurant Group" to "Kababjees Premium". Save.
- **Expected:** Within 10 seconds the POS order screen top-left shows "Kababjees Premium" instead of "Kababjees Restaurant Group".

**Test 11.3 — Upload logo and verify on POS:**
- **Steps:** On Branding page, upload a PNG logo image. Save.
- **Expected:** On the POS login screen the logo area shows the uploaded image instead of the default lightning bolt icon. On receipts the logo prints if show logo on receipt is enabled.

**Test 11.4 — FBR settings saved and appear on receipt:**
- **Steps:** Enable FBR Integration on Branding page. Enter NTN 1234567-8. Enter FBR POS ID. Enable Show NTN on Receipt. Save. Complete a payment on POS and go to receipt screen.
- **Expected:** Receipt preview shows NTN: 1234567-8 below the restaurant name. FBR QR code placeholder appears at the bottom of the receipt.

**Test 11.5 — Tax rate change reflects on POS:**
- **Steps:** On Branding → Tax Configuration, change Dine-In Tax Rate from 17% to 5%. Save. On POS, add an item priced PKR 1000 and check the cart totals.
- **Expected:** Tax amount shows PKR 50 (5% of 1000) not PKR 170. ORDER TOTAL shows PKR 1050.

**Test 11.6 — Receipt footer change reflects on receipt:**
- **Steps:** On Branding, change Receipt Footer to "Thank you for choosing Kababjees! Download our app.". Save. Complete a payment on POS.
- **Expected:** Receipt screen shows the new footer text at the bottom of the receipt preview.

**Test 11.7 — Revert color to orange:**
- **Steps:** After Test 11.1 changed color to blue, change it back to #FF5722. Save.
- **Expected:** POS returns to orange within 10 seconds.

## SECTION 12 — Shift Management

**Test 12.1 — Shift opened on POS appears in admin:**
- **Steps:** On POS, open a new shift with float PKR 5000.
- **Expected:** In admin Business → Shift Management, a new shift appears with status OPEN, cashier name, opening float PKR 5000, and the opening time.

**Test 12.2 — Shift closed on POS appears in admin:**
- **Steps:** On POS, close the shift with closing cash PKR 8000.
- **Expected:** The shift in admin updates to CLOSED status with closing cash, variance (PKR 3000 over in this case), and closed at timestamp.

**Test 12.3 — Shift report shows correct totals:**
- **Steps:** Find a closed shift in admin Shift Management. Click to view its report.
- **Expected:** The report shows: total orders during the shift, revenue broken down by payment method, opening float, expected closing cash, actual closing cash, and variance. All numbers match what was actually transacted.

## SECTION 13 — Analytics

**Test 13.1 — Revenue chart data is accurate:**
- **Steps:** Navigate to Analytics. Select This Week date range.
- **Expected:** Revenue chart shows correct totals per day. Click any data point and the detail shows the orders that make up that revenue figure.

**Test 13.2 — Top items report:**
- **Steps:** View the Top Items section in Analytics.
- **Expected:** Items are ranked by quantity sold, not by revenue. Each item shows quantity sold and total revenue generated. Items with zero sales in the period do not appear.

## SECTION 14 — Plan Restrictions

**Test 14.1 — STARTER plan restrictions:**
- **Steps:** Change tenant plan to STARTER in the database. Log in as owner. Navigate through the sidebar.
- **Expected:** Analytics section shows a lock overlay. KDS Monitor shows a lock. Aggregators shows a lock. Fleet and Delivery shows a lock. QR Ordering shows a lock. Custom Branding colors field is disabled with an Upgrade to PRO note. Branches section limits Add Branch — if they already have 2 branches the button is disabled with tooltip "Upgrade to add more branches".

**Test 14.2 — Locked feature click behavior:**
- **Steps:** On STARTER plan, click a locked sidebar item.
- **Expected:** An upgrade modal opens showing what the current plan includes, what is locked, and a Upgrade to PRO button. The upgrade button links to the Billing page or opens a contact sales flow.

**Test 14.3 — PRO plan unlocks features:**
- **Steps:** Change plan to PRO. Refresh the dashboard.
- **Expected:** Lock icons disappear from Analytics, KDS, Aggregators. All previously locked features are now accessible.

## SECTION 15 — Full Circle: Complete Order from Admin to POS to Admin

**Test 15.1 — Complete end-to-end order lifecycle:**
- **Precondition:** Admin dashboard and POS both open in separate windows. Shift is open on POS.
- **Step 1:** On admin Menu, verify Mutton Karahi is available at PKR 3600.
- **Step 2:** On POS, go to Table Map. Tap Table T-3 (green). Navigate to order screen.
- **Step 3:** Tap Mutton Karahi. Select Full variation. Verify cart shows PKR 3600.
- **Step 4:** Verify admin Live Orders shows a NEW ORDER in PENDING column within 5 seconds (this only works if the order is created when Kitchen is pressed — otherwise verify after Step 5).
- **Step 5:** Press KITCHEN. Verify success toast on POS. Verify order moves to IN KITCHEN on admin Live Orders.
- **Step 6:** On admin KDS Monitor, find the order. Click Mark All Ready.
- **Step 7:** On POS Tickets, verify the order now shows READY status with Collect Payment button.
- **Step 8:** Tap Collect Payment on POS Tickets. Verify checkout opens with correct total.
- **Step 9:** Enter cash PKR 5000. Verify change shows PKR 786 (5000 - 3600 - 612 tax). Tap Confirm Payment.
- **Step 10:** Verify receipt screen shows. Verify table T-3 on POS Table Map is now yellow (dirty).
- **Step 11:** On admin Live Orders, verify the order moved to COMPLETED column.
- **Step 12:** On admin Order History, verify the order appears with correct amount, payment method Cash, cashier name, and table T-3.
- **Step 13:** On admin Inventory, verify stock was deducted for any ingredients linked to Mutton Karahi via its recipe.
- **Step 14:** On admin Dashboard home, verify today's revenue increased by PKR 3600 (or the net amount).
- **Step 15:** On admin Shift Management, verify the shift now shows this order in its running totals.

All 15 steps must pass without manual database intervention, page refreshes, or restarting any service. If any step fails, the specific integration point it represents is broken and must be fixed before production launch.
