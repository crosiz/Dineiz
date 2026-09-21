import { prisma, Prisma } from '@dineiz/pos-portal-db';

export interface BranchSettingsBlob {
  receipt: {
    header: string;
    footer: string;
    paperSize: string;
    showLogo: boolean;
    showTaxBreakdown: boolean;
  };
  tax: {
    cashTaxRate: number;
    cardTaxRate: number;
    taxRegistrationNumber: string;
  };
  payments: {
    cash: boolean;
    card: boolean;
    jazzcash: boolean;
    easypaisa: boolean;
  };
  workflow: {
    autoAcceptOrders: boolean;
    requireManagerPinForDiscounts: boolean;
    autoPrintKot: boolean;
  };
  notifications: {
    newOrderAlerts: boolean;
    lowStockAlerts: boolean;
    shiftReminders: boolean;
    dailySummaryEmail: boolean;
  };
  backup: {
    lastBackupAt: string | null;
    frequency: string;
    storageUsedGb: number;
    storageLimitGb: number;
  };
}

const DEFAULT_SETTINGS: BranchSettingsBlob = {
  receipt: { header: '', footer: 'Thank you for dining with us!', paperSize: '80mm', showLogo: true, showTaxBreakdown: true },
  tax: { cashTaxRate: 0.05, cardTaxRate: 0.17, taxRegistrationNumber: '' },
  payments: { cash: true, card: true, jazzcash: true, easypaisa: true },
  workflow: { autoAcceptOrders: false, requireManagerPinForDiscounts: true, autoPrintKot: true },
  notifications: { newOrderAlerts: true, lowStockAlerts: true, shiftReminders: false, dailySummaryEmail: true },
  backup: { lastBackupAt: null, frequency: 'Daily', storageUsedGb: 0, storageLimitGb: 10 },
};

export async function getSettings(branchId: string): Promise<BranchSettingsBlob> {
  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { settings: true } });
  const stored = (branch?.settings as Partial<BranchSettingsBlob> | null) ?? {};
  return {
    receipt: { ...DEFAULT_SETTINGS.receipt, ...stored.receipt },
    tax: { ...DEFAULT_SETTINGS.tax, ...stored.tax },
    payments: { ...DEFAULT_SETTINGS.payments, ...stored.payments },
    workflow: { ...DEFAULT_SETTINGS.workflow, ...stored.workflow },
    notifications: { ...DEFAULT_SETTINGS.notifications, ...stored.notifications },
    backup: { ...DEFAULT_SETTINGS.backup, ...stored.backup },
  };
}

export async function updateSettings(branchId: string, patch: Partial<BranchSettingsBlob>): Promise<BranchSettingsBlob> {
  const current = await getSettings(branchId);
  const merged: BranchSettingsBlob = {
    receipt: { ...current.receipt, ...patch.receipt },
    tax: { ...current.tax, ...patch.tax },
    payments: { ...current.payments, ...patch.payments },
    workflow: { ...current.workflow, ...patch.workflow },
    notifications: { ...current.notifications, ...patch.notifications },
    backup: { ...current.backup, ...patch.backup },
  };
  await prisma.branch.update({ where: { id: branchId }, data: { settings: merged as unknown as Prisma.InputJsonValue } });
  return merged;
}
