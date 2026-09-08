// Ids are app-generated TEXT (crypto.randomUUID()) rather than INTEGER
// AUTOINCREMENT so rows can share shapes/types with @dineiz/pos-logic and,
// eventually, the cloud schema — see dineiz/decisions/0003-standalone-architecture.
// Money columns are INTEGER whole rupees, matching the formatPKR() convention.
export const migration001Init = `
CREATE TABLE restaurant (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  ntn TEXT,
  logo_path TEXT,
  cash_tax_rate REAL NOT NULL DEFAULT 5,
  card_tax_rate REAL NOT NULL DEFAULT 17,
  receipt_header TEXT,
  receipt_footer TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  password_hash TEXT,
  pin_hash TEXT,
  role TEXT NOT NULL CHECK (role IN ('OWNER', 'MANAGER', 'CASHIER')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE items (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES categories(id),
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  is_available INTEGER NOT NULL DEFAULT 1,
  image_path TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE variations (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES items(id),
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE addons (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES items(id),
  name TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE floors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE tables (
  id TEXT PRIMARY KEY,
  floor_id TEXT NOT NULL REFERENCES floors(id),
  label TEXT NOT NULL,
  seats INTEGER NOT NULL DEFAULT 2,
  pos_x REAL NOT NULL DEFAULT 0,
  pos_y REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'FREE'
    CHECK (status IN ('FREE', 'OCCUPIED', 'RESERVED', 'DIRTY', 'INACTIVE'))
);

CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  name TEXT,
  phone TEXT UNIQUE,
  email TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE shifts (
  id TEXT PRIMARY KEY,
  cashier_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
  opening_float INTEGER NOT NULL DEFAULT 0,
  closing_float INTEGER,
  expected_cash INTEGER,
  variance INTEGER,
  opened_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at TEXT
);

CREATE TABLE shift_activities (
  id TEXT PRIMARY KEY,
  shift_id TEXT NOT NULL REFERENCES shifts(id),
  type TEXT NOT NULL CHECK (type IN ('BREAK_START', 'BREAK_END', 'CASH_IN', 'CASH_OUT')),
  amount INTEGER,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('DINE_IN', 'TAKEAWAY', 'DELIVERY')),
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'IN_KITCHEN', 'READY', 'COMPLETED', 'CANCELLED')),
  table_id TEXT REFERENCES tables(id),
  customer_id TEXT REFERENCES customers(id),
  shift_id TEXT NOT NULL REFERENCES shifts(id),
  cashier_id TEXT NOT NULL REFERENCES users(id),
  subtotal INTEGER NOT NULL DEFAULT 0,
  tax_rate REAL NOT NULL DEFAULT 0,
  tax_amount INTEGER NOT NULL DEFAULT 0,
  discount_amount INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  item_id TEXT NOT NULL REFERENCES items(id),
  variation_id TEXT REFERENCES variations(id),
  name TEXT NOT NULL,
  unit_price INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  addons_json TEXT NOT NULL DEFAULT '[]',
  notes TEXT
);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  method TEXT NOT NULL CHECK (method IN ('CASH', 'CARD', 'JAZZCASH', 'EASYPAISA')),
  amount INTEGER NOT NULL,
  tendered_amount INTEGER,
  change_amount INTEGER,
  tax_rate REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE ingredients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('KG', 'G', 'L', 'ML', 'PCS')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE stock (
  ingredient_id TEXT PRIMARY KEY REFERENCES ingredients(id),
  quantity REAL NOT NULL DEFAULT 0,
  reorder_level REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE recipes (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL UNIQUE REFERENCES items(id)
);

CREATE TABLE recipe_lines (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL REFERENCES recipes(id),
  ingredient_id TEXT NOT NULL REFERENCES ingredients(id),
  quantity REAL NOT NULL
);

CREATE TABLE stock_movements (
  id TEXT PRIMARY KEY,
  ingredient_id TEXT NOT NULL REFERENCES ingredients(id),
  type TEXT NOT NULL CHECK (type IN ('PURCHASE', 'SALE_DEDUCTION', 'ADJUSTMENT', 'WASTAGE')),
  quantity REAL NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE app_meta (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX idx_orders_shift_status ON orders(shift_id, status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_items_category_available ON items(category_id, is_available);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_shift_activities_shift ON shift_activities(shift_id);
CREATE INDEX idx_stock_movements_ingredient ON stock_movements(ingredient_id);
CREATE INDEX idx_tables_floor ON tables(floor_id);
`
