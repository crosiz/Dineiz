# Complete E2E Testing Document

This document covers all manual and automated End-to-End test cases for the Dineiz platform, which includes the **Admin Panel**, **POS Application**, and **Sync & Coordination**.

## Admin Panel Tests (AP)

### AP-001
- **Category**: Authentication and Role-Based Access
- **Description**: Business owner login with correct credentials passes and shows full sidebar.
- **Preconditions**: Owner account exists.
- **Steps**:
  1. Navigate to Admin Panel `/login`.
  2. Enter owner email and password.
  3. Click "Sign In".
- **Expected Result**: Successfully logs in. Sidebar shows all items (Menu, Fleet, CRM, Branding, Billing, etc.).
- [x] **Pass / Fail**

### AP-002
- **Category**: Authentication and Role-Based Access
- **Description**: Business owner login with wrong password shows error and does not log in.
- **Preconditions**: Owner account exists.
- **Steps**:
  1. Navigate to Admin Panel `/login`.
  2. Enter owner email and incorrect password.
  3. Click "Sign In".
- **Expected Result**: An error message appears. User remains on the login page.
- [x] **Pass / Fail**

### AP-003
- **Category**: Authentication and Role-Based Access
- **Description**: Branch manager login shows restricted sidebar without Billing, Branding, Analytics, CRM.
- **Preconditions**: Branch Manager account exists.
- **Steps**:
  1. Navigate to Admin Panel `/login`.
  2. Enter branch manager email and password.
  3. Click "Sign In".
- **Expected Result**: Successfully logs in. Sidebar hides restricted sections.
- [x] **Pass / Fail**

### AP-004
- **Category**: Security
- **Description**: Branch manager cannot access `/dashboard/billing` by direct URL navigation.
- **Preconditions**: Logged in as Branch Manager.
- **Steps**:
  1. Manually type `/dashboard/settings/billing` in the URL bar.
  2. Press Enter.
- **Expected Result**: User is redirected away or sees a "Permission Denied" page.
- [x] **Pass / Fail**

### AP-005
- **Category**: Staff Management
- **Description**: Business owner creates branch manager via Staff and Roles and manager can log in.
- **Preconditions**: Logged in as Owner.
- **Steps**:
  1. Navigate to Staff & Roles.
  2. Click "Add Staff Member".
  3. Enter details and assign Branch Manager role.
  4. Save. Log out and log in with new credentials.
- **Expected Result**: New manager can successfully log in.
- [x] **Pass / Fail**

### AP-006
- **Category**: Authentication and Role-Based Access
- **Description**: Session persists after browser refresh for both owner and manager.
- **Preconditions**: Logged in to Admin Panel.
- **Steps**:
  1. Refresh the browser page.
- **Expected Result**: User remains logged in and stays on the same page.
- [x] **Pass / Fail**

### AP-007
- **Category**: Authentication and Role-Based Access
- **Description**: Session expires gracefully and redirects to login without crash.
- **Preconditions**: Logged in, session token cleared or expired.
- **Steps**:
  1. Clear cookies or local storage.
  2. Refresh the page or click a link.
- **Expected Result**: Redirected to `/login` smoothly.
- [x] **Pass / Fail**

### AP-008
- **Category**: UI/UX
- **Description**: Owner sees all branches in header dropdown, manager sees only their branch as static text.
- **Preconditions**: Both Owner and Manager accounts exist.
- **Steps**:
  1. Log in as Owner and check header.
  2. Log in as Manager and check header.
- **Expected Result**: Owner can click and select branches; Manager sees just their branch name.
- [x] **Pass / Fail**

### AP-009
- **Category**: Dashboard Home
- **Description**: Dashboard home KPI cards show real numbers.
- **Preconditions**: Logged in to Admin Panel.
- **Steps**:
  1. Navigate to `/dashboard`.
- **Expected Result**: KPI cards (Revenue, Orders, etc.) load and display numbers.
- [x] **Pass / Fail**

### AP-010
- **Category**: Dashboard Home
- **Description**: Dashboard home revenue chart has data points.
- **Preconditions**: Logged in to Admin Panel.
- **Steps**:
  1. Navigate to `/dashboard`.
- **Expected Result**: Revenue chart renders successfully with axes.
- [x] **Pass / Fail**

### AP-011
- **Category**: Dashboard Home
- **Description**: Dashboard recent orders section shows recent orders.
- **Preconditions**: Orders exist in the system.
- **Steps**:
  1. Navigate to `/dashboard`.
- **Expected Result**: Recent orders list populates correctly.
- [x] **Pass / Fail**

### AP-013
- **Category**: Live Orders
- **Description**: Live Orders shows only today orders.
- **Preconditions**: Orders exist from today and yesterday.
- **Steps**:
  1. Navigate to Live Orders.
- **Expected Result**: Only orders from today are displayed. Columns load properly.
- [x] **Pass / Fail**

### AP-020
- **Category**: Live Orders
- **Description**: Live Orders fullscreen button works.
- **Preconditions**: Logged in to Live Orders.
- **Steps**:
  1. Click the Fullscreen button.
- **Expected Result**: UI enters fullscreen mode hiding the sidebar.
- [x] **Pass / Fail**

### AP-021 & AP-025
- **Category**: Order History
- **Description**: Order History filters by type, status, and cashier.
- **Preconditions**: Historical orders exist.
- **Steps**:
  1. Navigate to Order History.
  2. Use Type, Status, and Cashier dropdowns.
- **Expected Result**: Table updates to reflect selected filters.
- [x] **Pass / Fail**

### AP-023
- **Category**: Order History
- **Description**: Order History export Excel downloads file.
- **Preconditions**: Order History loaded.
- **Steps**:
  1. Click Export Excel.
- **Expected Result**: Download triggers successfully.
- [x] **Pass / Fail**

### AP-024
- **Category**: Order History
- **Description**: Order History order detail slide-over shows items.
- **Preconditions**: Order History loaded.
- **Steps**:
  1. Click "View" on an order.
- **Expected Result**: Slide-over panel opens showing total and order items.
- [x] **Pass / Fail**

### AP-046
- **Category**: Inventory
- **Description**: Inventory stock levels display.
- **Preconditions**: Inventory items exist.
- **Steps**:
  1. Navigate to Inventory.
- **Expected Result**: Stock levels are displayed.
- [x] **Pass / Fail**

### AP-048
- **Category**: Inventory
- **Description**: Purchase Order creation.
- **Preconditions**: Logged in as Admin.
- **Steps**:
  1. Navigate to Purchase Orders.
  2. Create a new Purchase Order.
- **Expected Result**: Purchase order modal opens and allows saving.
- [x] **Pass / Fail**

### AP-049
- **Category**: Branding
- **Description**: Change primary brand color.
- **Preconditions**: Logged in as Owner.
- **Steps**:
  1. Navigate to Branding settings.
  2. Change primary color.
  3. Click "Save Changes".
- **Expected Result**: Color updates and saves successfully.
- [x] **Pass / Fail**

### AP-050
- **Category**: Branding
- **Description**: Update restaurant name.
- **Preconditions**: Logged in as Owner.
- **Steps**:
  1. Navigate to Branding settings.
  2. Change restaurant name.
  3. Click "Save Changes".
- **Expected Result**: Restaurant name updates and saves successfully.
- [x] **Pass / Fail**

### AP-053 & AP-054
- **Category**: Settings
- **Description**: Update Store Info and Tax Rate.
- **Preconditions**: Logged in as Owner.
- **Steps**:
  1. Navigate to Settings -> Store Info.
  2. Update tax rate and save.
- **Expected Result**: Settings updated successfully.
- [x] **Pass / Fail**

### AP-060 & AP-064
- **Category**: Settings
- **Description**: Billing settings display current plan.
- **Preconditions**: Logged in as Owner.
- **Steps**:
  1. Navigate to Settings -> Billing.
- **Expected Result**: Plan details are visible.
- [x] **Pass / Fail**

---

## POS Tests (POS)

### POS-001
- **Category**: Authentication
- **Description**: PIN Login works.
- **Preconditions**: POS app is open, Staff exists.
- **Steps**:
  1. Navigate to `/login`.
  2. Select Staff, enter correct PIN.
- **Expected Result**: Logs in and redirects to shift or home.
- [x] **Pass / Fail**

### POS-002
- **Category**: Orders
- **Description**: Create Dine-in order.
- **Preconditions**: Logged in to POS.
- **Steps**:
  1. Go to Tables, select table.
  2. Add item.
  3. Click KITCHEN.
- **Expected Result**: Success toast appears, table turns occupied.
- [x] **Pass / Fail**

### POS-003
- **Category**: Orders
- **Description**: Active orders strip order appears on home dashboard.
- **Preconditions**: Order created.
- **Steps**:
  1. Go to `/pos/home`.
- **Expected Result**: Order appears in the Active Orders strip.
- [x] **Pass / Fail**

---

## Coordination Tests (CO)

### CO-001
- **Category**: End-to-End Sync
- **Description**: Complete end-to-end order lifecycle (POS -> Admin).
- **Preconditions**: POS and Admin apps running.
- **Steps**:
  1. Create order on POS.
  2. Verify order appears on Admin Live Orders.
  3. Mark Ready in Admin.
  4. Deliver on POS.
  5. Check Order History in Admin.
- **Expected Result**: Order synchronizes perfectly at all states.
- [x] **Pass / Fail**

### CO-002
- **Category**: Data Sync
- **Description**: Admin toggles Out of Stock, POS updates.
- **Preconditions**: POS and Admin apps running.
- **Steps**:
  1. Admin marks an item as out of stock.
  2. POS checks the item.
- **Expected Result**: Item is greyed out / marked out of stock on POS without reload.
- [x] **Pass / Fail**

### CO-003
- **Category**: Data Sync
- **Description**: Admin adds table, POS updates map.
- **Preconditions**: POS and Admin apps running.
- **Steps**:
  1. Admin creates a new table on the floor plan.
  2. POS opens the table view.
- **Expected Result**: New table appears on the POS floor plan immediately.
- [x] **Pass / Fail**
