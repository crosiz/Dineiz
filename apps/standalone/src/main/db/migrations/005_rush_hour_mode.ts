export const migration005RushHourMode = `
ALTER TABLE restaurant ADD COLUMN rush_hour_mode INTEGER NOT NULL DEFAULT 0;
`
