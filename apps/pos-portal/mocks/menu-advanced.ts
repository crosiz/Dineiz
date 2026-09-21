export type VariationGroup = { name: string; appliesTo: string; options: { label: string; priceDelta: number }[] };

export const VARIATION_GROUPS: VariationGroup[] = [
  {
    name: "Biryani Portion",
    appliesTo: "Biryani & Rice",
    options: [
      { label: "Half", priceDelta: -150 },
      { label: "Full", priceDelta: 0 },
    ],
  },
  {
    name: "Karahi Size",
    appliesTo: "Karahi",
    options: [
      { label: "Half", priceDelta: -900 },
      { label: "Full", priceDelta: 0 },
      { label: "Family (1.5x)", priceDelta: 950 },
    ],
  },
];

export type AddOnGroup = { name: string; options: { label: string; price: number }[] };

export const ADDON_GROUPS: AddOnGroup[] = [
  {
    name: "Extra Toppings",
    options: [
      { label: "Extra Cheese", price: 150 },
      { label: "Extra Raita", price: 80 },
    ],
  },
  {
    name: "Sides",
    options: [
      { label: "Extra Naan", price: 60 },
      { label: "Salad", price: 120 },
    ],
  },
];

export type Deal = { name: string; description: string; price: number; originalPrice: number; active: boolean };

export const DEALS: Deal[] = [
  { name: "Family Feast", description: "Full Chicken Karahi + 4 Naan + 1.5L Drink", price: 2800, originalPrice: 3350, active: true },
  { name: "Lunch Combo", description: "Chicken Biryani + Soft Drink + Raita", price: 650, originalPrice: 780, active: true },
  { name: "BBQ Platter for 2", description: "Seekh Kebab + Chicken Tikka + 2 Naan", price: 1990, originalPrice: 2340, active: false },
];
