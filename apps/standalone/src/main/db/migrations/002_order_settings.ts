export const migration002OrderSettings = `
ALTER TABLE restaurant ADD COLUMN tax_rounding_method TEXT NOT NULL DEFAULT 'ROUND'
  CHECK (tax_rounding_method IN ('ROUND', 'FLOOR', 'CEIL'));
ALTER TABLE restaurant ADD COLUMN cash_tax_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE restaurant ADD COLUMN card_tax_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE restaurant ADD COLUMN void_requires_manager_approval INTEGER NOT NULL DEFAULT 0;
`
