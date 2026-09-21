export type SettingField = { label: string; description?: string; value: string };
export type SettingToggle = { label: string; description?: string; enabled: boolean };

export const BRANCH_SETTINGS: SettingField[] = [
  { label: "Branch Name", value: "Clifton" },
  { label: "Branch Code", value: "SS-KHI-001" },
  { label: "Address", value: "Block 2, Clifton, Karachi" },
  { label: "Phone", value: "+92 21 1234567" },
  { label: "Operating Hours", value: "12:00 PM – 1:00 AM" },
];

export const RECEIPT_SETTINGS: SettingField[] = [
  { label: "Receipt Header", value: "Kababjees — Clifton Branch" },
  { label: "Receipt Footer", value: "Thank you for dining with us!" },
  { label: "Paper Size", value: "80mm" },
];

export const RECEIPT_TOGGLES: SettingToggle[] = [
  { label: "Show logo on receipt", enabled: true },
  { label: "Show tax breakdown", enabled: true },
];

export const TAX_SETTINGS: SettingField[] = [
  { label: "Cash Tax Rate", description: "Applied to cash payments", value: "5%" },
  { label: "Card Tax Rate", description: "Applied to card, JazzCash, EasyPaisa", value: "17%" },
  { label: "Tax Registration Number", value: "NTN-1234567-8" },
];

export const PAYMENT_TOGGLES: SettingToggle[] = [
  { label: "Cash", enabled: true },
  { label: "Card", enabled: true },
  { label: "JazzCash", enabled: true },
  { label: "EasyPaisa", enabled: true },
];

export const WORKFLOW_TOGGLES: SettingToggle[] = [
  { label: "Auto-accept incoming orders", description: "Skip manual confirmation for aggregator orders", enabled: false },
  { label: "Require manager PIN for discounts", enabled: true },
  { label: "Auto-print KOT on send", enabled: true },
];

export type Device = { name: string; type: string; status: "PAIRED" | "OFFLINE" };

export const DEVICES: Device[] = [
  { name: "Front Counter Printer", type: "Receipt Printer", status: "PAIRED" },
  { name: "Kitchen Display", type: "KDS Screen", status: "PAIRED" },
  { name: "Cash Drawer", type: "Drawer", status: "PAIRED" },
  { name: "BBQ Station Printer", type: "Kitchen Printer", status: "OFFLINE" },
];

export const NOTIFICATION_TOGGLES: SettingToggle[] = [
  { label: "New order alerts", enabled: true },
  { label: "Low stock alerts", enabled: true },
  { label: "Shift reminders", enabled: false },
  { label: "Daily summary email", enabled: true },
];

export const BACKUP_INFO: SettingField[] = [
  { label: "Last Backup", value: "Today, 4:00 AM" },
  { label: "Backup Frequency", value: "Daily" },
  { label: "Storage Used", value: "1.2 GB of 10 GB" },
];
