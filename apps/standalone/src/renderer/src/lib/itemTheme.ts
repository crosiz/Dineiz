// Themed gradient + emoji fallback for menu items with no photo, keyed by
// keyword match against the item/category name — mirrors the cloud POS's
// MenuItemCard THEMES map so an item without a photo still looks like a
// designed placeholder, not a broken/empty box.

export interface ItemTheme {
  gradient: string
  emoji: string
}

const THEMES: { keywords: string[]; theme: ItemTheme }[] = [
  { keywords: ['karahi', 'curry', 'gravy', 'qorma', 'korma'], theme: { gradient: 'from-orange-200 to-red-200', emoji: '🍛' } },
  { keywords: ['biryani', 'pulao', 'rice'], theme: { gradient: 'from-amber-200 to-yellow-100', emoji: '🍚' } },
  {
    keywords: ['bbq', 'tikka', 'kabab', 'kebab', 'grill', 'seekh', 'boti'],
    theme: { gradient: 'from-red-200 to-orange-100', emoji: '🍢' }
  },
  { keywords: ['burger', 'sandwich', 'zinger', 'roll'], theme: { gradient: 'from-yellow-200 to-amber-100', emoji: '🍔' } },
  { keywords: ['pizza'], theme: { gradient: 'from-red-200 to-yellow-100', emoji: '🍕' } },
  {
    keywords: ['drink', 'juice', 'soda', 'beverage', 'shake', 'tea', 'coffee', 'lassi'],
    theme: { gradient: 'from-sky-200 to-cyan-100', emoji: '🥤' }
  },
  {
    keywords: ['dessert', 'sweet', 'ice cream', 'kulfi', 'kheer', 'gulab'],
    theme: { gradient: 'from-pink-200 to-purple-100', emoji: '🍨' }
  },
  { keywords: ['bread', 'naan', 'roti', 'paratha'], theme: { gradient: 'from-yellow-100 to-orange-50', emoji: '🫓' } },
  { keywords: ['salad'], theme: { gradient: 'from-green-200 to-lime-100', emoji: '🥗' } },
  { keywords: ['soup'], theme: { gradient: 'from-orange-100 to-amber-50', emoji: '🍲' } },
  { keywords: ['fish', 'seafood', 'prawn', 'machli'], theme: { gradient: 'from-blue-200 to-cyan-100', emoji: '🐟' } },
  { keywords: ['chinese', 'noodle', 'chowmein', 'manchurian'], theme: { gradient: 'from-red-100 to-yellow-100', emoji: '🍜' } }
]

const DEFAULT_THEME: ItemTheme = { gradient: 'from-slate-200 to-slate-100', emoji: '🍽️' }

export function getItemTheme(name: string, categoryName?: string): ItemTheme {
  const text = `${name} ${categoryName ?? ''}`.toLowerCase()
  for (const { keywords, theme } of THEMES) {
    if (keywords.some((k) => text.includes(k))) return theme
  }
  return DEFAULT_THEME
}
