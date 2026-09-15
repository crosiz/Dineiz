import Papa from 'papaparse';

/** CSV columns for bulk import / export, in canonical order. */
export const MENU_CSV_COLUMNS = [
  'category',
  'category_description',
  'item_name',
  'item_description',
  'base_price',
  'unit_type',
  'is_available',
  'tags',
  'variations',
  'add_ons',
] as const;

export const TEMPLATE_URL = '/templates/menu-bulk-upload-template.csv';

export const UNIT_TYPES = [
  'Per Item',
  'Per KG',
  'Per 500g',
  'Per 250g',
  'Per 100g',
  'Per Litre',
  'Per 500ml',
] as const;

export interface ColumnDoc {
  name: string;
  required: boolean;
  example: string;
  notes: string;
}

export const MENU_CSV_COLUMN_DOCS: ColumnDoc[] = [
  { name: 'category', required: true, example: 'Burgers', notes: 'Created automatically if it does not exist yet.' },
  { name: 'category_description', required: false, example: 'Flame-grilled burgers', notes: 'Only used when the category is first created.' },
  { name: 'item_name', required: true, example: 'Zinger Burger', notes: 'Unique within its category.' },
  { name: 'item_description', required: false, example: 'Crispy chicken fillet…', notes: 'Wrap in "quotes" if it contains a comma.' },
  { name: 'base_price', required: true, example: '650', notes: 'Whole number, PKR. No currency symbol or commas.' },
  { name: 'unit_type', required: false, example: 'Per Item', notes: `One of: ${UNIT_TYPES.join(', ')}. Blank = Per Item.` },
  { name: 'is_available', required: false, example: 'true', notes: 'true / false. Blank = true.' },
  { name: 'tags', required: false, example: 'Bestseller;Spicy', notes: 'Separate multiple tags with a semicolon.' },
  { name: 'variations', required: false, example: 'Single:0;Double:250', notes: 'Name:price pairs, semicolon-separated. Price is the full price for that size (0 = same as base_price).' },
  { name: 'add_ons', required: false, example: 'Extra Cheese:80', notes: 'Name:price pairs, semicolon-separated. Price is the surcharge added on top.' },
];

/** [{name,price}] -> "Name:price;Name:price" */
export function encodePriceOptions(opts?: Array<{ name: string; price: number | string }>): string {
  if (!opts?.length) return '';
  return opts
    .filter((o) => o?.name)
    .map((o) => `${o.name}:${Number(o.price) || 0}`)
    .join(';');
}

/** Build an export CSV from the loaded categories + items, in template column order. */
export function menuToCsv(categories: any[], items: any[]): string {
  const catById = new Map(categories.map((c: any) => [c.id, c]));
  const data = items.map((it: any) => {
    const cat: any = catById.get(it.categoryId) || {};
    return {
      category: cat.name || it.category?.name || '',
      category_description: cat.description || '',
      item_name: it.name || '',
      item_description: it.description || '',
      base_price: Math.round(Number(it.globalBasePrice ?? it.basePrice ?? 0)),
      unit_type: it.unitType || 'Per Item',
      is_available: it.isAvailable ? 'true' : 'false',
      tags: (it.tags || []).join(';'),
      variations: encodePriceOptions(it.variations),
      add_ons: encodePriceOptions(it.addOns),
    };
  });
  return Papa.unparse({ fields: [...MENU_CSV_COLUMNS], data });
}

/** Trigger a client-side download of CSV text. */
export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
