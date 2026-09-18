// What each table status looks like, everywhere a table is drawn (Home's table
// grid, the floor plan, the list view). One palette, so "blue" means the same
// thing on every screen:
//   free      — neutral tile, green dot: nothing to do
//   occupied  — blue, the dine-in colour: a party is seated
//   bill      — brand orange, the money colour: collect payment
//   reserved  — purple
//   to clean  — grey: needs a wipe before it can be seated

export const TABLE_TONE = {
  FREE: {
    label: 'free',
    dot: 'bg-ok',
    tile: 'bg-surface border-line text-ink hover:border-line-strong',
  },
  OCCUPIED: {
    label: 'occupied',
    dot: 'bg-info',
    tile: 'bg-info/10 border-info/25 text-info hover:bg-info/15',
  },
  BILL_REQUESTED: {
    label: 'bill',
    dot: 'bg-brand',
    tile: 'bg-brand/10 border-brand/30 text-brand-strong hover:bg-brand/15',
  },
  RESERVED: {
    label: 'reserved',
    dot: 'bg-special',
    tile: 'bg-special/10 border-special/25 text-special hover:bg-special/15',
  },
  DIRTY: {
    label: 'to clean',
    dot: 'bg-ink-4',
    tile: 'bg-sunken border-line text-ink-3 hover:border-line-strong',
  },
} as const;

export type TableToneKey = keyof typeof TABLE_TONE;

export function tableTone(status: string | null | undefined) {
  return TABLE_TONE[(status ?? 'FREE') as TableToneKey] ?? TABLE_TONE.FREE;
}
