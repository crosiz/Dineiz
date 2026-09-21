export type MenuCategory = { id: string; label: string };

export type MenuItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  popular?: boolean;
};

export const MENU_CATEGORIES: MenuCategory[] = [
  { id: "bbq", label: "BBQ & Grills" },
  { id: "karahi", label: "Karahi" },
  { id: "biryani", label: "Biryani & Rice" },
  { id: "appetizers", label: "Appetizers" },
  { id: "bread", label: "Naan & Bread" },
  { id: "beverages", label: "Beverages" },
  { id: "desserts", label: "Desserts" },
];

export const MENU_ITEMS: MenuItem[] = [
  { id: "seekh-kebab", name: "Seekh Kebab (6 pcs)", category: "bbq", price: 890, popular: true },
  { id: "chicken-tikka", name: "Chicken Tikka (Full)", category: "bbq", price: 1250, popular: true },
  { id: "malai-boti", name: "Malai Boti", category: "bbq", price: 1100 },
  { id: "beef-boti", name: "Beef Boti", category: "bbq", price: 1350 },
  { id: "chicken-wings", name: "Peri Peri Wings", category: "bbq", price: 750 },
  { id: "chicken-karahi", name: "Chicken Karahi (Full)", category: "karahi", price: 2100, popular: true },
  { id: "chicken-karahi-half", name: "Chicken Karahi (Half)", category: "karahi", price: 1200 },
  { id: "mutton-karahi", name: "Mutton Karahi (Full)", category: "karahi", price: 3400 },
  { id: "paneer-karahi", name: "Paneer Karahi", category: "karahi", price: 1450 },
  { id: "chicken-biryani", name: "Chicken Biryani", category: "biryani", price: 450, popular: true },
  { id: "mutton-biryani", name: "Mutton Biryani", category: "biryani", price: 650 },
  { id: "veg-pulao", name: "Vegetable Pulao", category: "biryani", price: 380 },
  { id: "plain-rice", name: "Plain Rice", category: "biryani", price: 250 },
  { id: "hummus", name: "Hummus with Bread", category: "appetizers", price: 550 },
  { id: "spring-rolls", name: "Spring Rolls (6 pcs)", category: "appetizers", price: 480 },
  { id: "chicken-soup", name: "Chicken Corn Soup", category: "appetizers", price: 420 },
  { id: "naan", name: "Naan", category: "bread", price: 60 },
  { id: "garlic-naan", name: "Garlic Naan", category: "bread", price: 90 },
  { id: "roghni-naan", name: "Roghni Naan", category: "bread", price: 80 },
  { id: "soft-drink", name: "Soft Drink (Can)", category: "beverages", price: 150 },
  { id: "fresh-lime", name: "Fresh Lime", category: "beverages", price: 280 },
  { id: "kashmiri-chai", name: "Kashmiri Chai", category: "beverages", price: 320 },
  { id: "kheer", name: "Kheer", category: "desserts", price: 380 },
  { id: "gulab-jamun", name: "Gulab Jamun (4 pcs)", category: "desserts", price: 420 },
];
