// Shared constants for the Physical Count screen.

// Matches the category list used in AddIngredientPanel.tsx, kept in sync
// manually since that file is owned by another workstream and isn't
// imported here to avoid cross-directory coupling.
export const CATEGORIES = [
  'MEAT', 'VEGETABLES', 'DAIRY', 'GRAINS', 'SPICES', 'OILS', 'BEVERAGES', 'PACKAGING', 'CLEANING', 'Other',
];

export const COUNT_TYPES: { value: 'FULL' | 'PARTIAL' | 'SPOT'; label: string; description: string }[] = [
  { value: 'FULL', label: 'Full Count', description: 'Count every ingredient in stock' },
  { value: 'PARTIAL', label: 'Partial Count', description: 'Count ingredients in selected categories' },
  { value: 'SPOT', label: 'Spot Check', description: 'Count a specific set of ingredients' },
];

// Variance-severity bands, expressed as % deviation from system quantity.
// Used to color each count line's variance cell.
export const VARIANCE_WARN_PCT = 2; // within this % of system qty = green ("on target")
export const VARIANCE_ALERT_PCT = 10; // within this % = amber, above = red

// No backend enforcement requires notes before completing a count with a
// large variance — this is a client-side nicety only, to nudge managers to
// leave an explanation when the stock impact is significant.
export const LARGE_VARIANCE_NOTES_THRESHOLD = 2000; // PKR
