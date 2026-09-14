import { prisma } from '@dineiz/db';

/**
 * The branding/config payload a POS terminal needs — tenant branding, dual-tax
 * config, receipt rendering, branch-level operational config, and the Part 13
 * settings blob. Shared by pin-login (first load) and GET /api/pos/branding
 * (re-sync on socket reconnect) so the two never drift into different shapes.
 */
export async function buildPosBranding(tenantId: string, branchId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, colorPrimary: true, logoUrl: true, settings: true }
  });

  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: {
      currency: true,
      timezone: true,
      kdsEnabled: true,
      kotAutoPrint: true,
      openingTime: true,
      closingTime: true,
    }
  });

  const tenantBranding = await prisma.tenantBranding.findUnique({
    where: { tenantId },
    select: {
      restaurantName: true,
      primaryColor: true,
      secondaryColor: true,
      accentColor: true,
      logoUrl: true,
      fbrNtn: true,
      receiptFooter: true,
      receiptHeader: true,
      showCashierName: true,
      showTableNumber: true,
      cashTaxEnabled: true,
      cashTaxRate: true,
      cashTaxLabel: true,
      cardTaxEnabled: true,
      cardTaxRate: true,
      cardTaxLabel: true,
      showDualTaxOnReceipt: true,
      cashTaxNote: true,
      cardTaxNote: true,
      taxRoundingMethod: true,
      serviceChargeEnabled: true,
      serviceChargeRate: true,
      showLogoOnReceipt: true,
      receiptPaperSize: true,
      receiptLayout: true,
      downloadPdfReceipt: true,
      showPoweredBy: true,
      orderNumberFormat: true, tenantShortCode: true, tableCleaningMinutes: true,
      requireShiftOpen: true, allowLoginWithoutShift: true,
      allowOrderReopen: true, orderReopenWindowMinutes: true,
      maxDiscountPercent: true, allowCashierDiscounts: true,
      voidRequiresManagerApproval: true, autoKotPrint: true, autoReceiptPrint: true,
      blockOutOfStock: true, kotEnabled: true, posMarkReadyEnabled: true,
      staleShiftWarnHours: true, autoCloseAbandonedHours: true,
      cashCountRequired: true, varianceAlertThreshold: true,
      managerOverlayEnabled: true, managerOverlayIdleMinutes: true, managerOverlayRequireReason: true,
      syncBatchSize: true, syncRequestTimeoutMs: true, syncMaxEventLifetimeHours: true,
      shiftCloseSyncTimeoutSec: true, allowCloseWithUnsynced: true, closeWithUnsyncedRequiresPin: true,
    }
  });
  const tb = tenantBranding as any;

  return {
    restaurantName: tenantBranding?.restaurantName || tenant?.name || 'Dineiz Go',
    primaryColor: tenantBranding?.primaryColor || tenant?.colorPrimary || '#F59E0B',
    secondaryColor: tenantBranding?.secondaryColor || '#1A1A2E',
    accentColor: tenantBranding?.accentColor || '#FFB300',
    logoUrl: tenantBranding?.logoUrl || tenant?.logoUrl,
    fbrNtn: tenantBranding?.fbrNtn,
    receiptFooter: tenantBranding?.receiptFooter,
    receiptHeader: tenantBranding?.receiptHeader,
    showCashierName: tenantBranding?.showCashierName ?? false,
    showTableNumber: tenantBranding?.showTableNumber ?? false,
    cashTaxEnabled: tenantBranding?.cashTaxEnabled ?? false,
    cashTaxRate: tenantBranding?.cashTaxRate ?? 5,
    cashTaxLabel: tenantBranding?.cashTaxLabel ?? 'GST (Cash)',
    cardTaxEnabled: tenantBranding?.cardTaxEnabled ?? false,
    cardTaxRate: tenantBranding?.cardTaxRate ?? 17,
    cardTaxLabel: tenantBranding?.cardTaxLabel ?? 'GST (Card/Digital)',
    showDualTaxOnReceipt: tenantBranding?.showDualTaxOnReceipt ?? true,
    cashTaxNote: tenantBranding?.cashTaxNote ?? null,
    cardTaxNote: tenantBranding?.cardTaxNote ?? null,
    taxRoundingMethod: tenantBranding?.taxRoundingMethod ?? 'ROUND',
    serviceChargeEnabled: tenantBranding?.serviceChargeEnabled ?? false,
    serviceChargeRate: tenantBranding?.serviceChargeRate ?? 10,
    showLogoOnReceipt: tenantBranding?.showLogoOnReceipt ?? true,
    receiptPaperSize: tenantBranding?.receiptPaperSize ?? '80mm',
    receiptLayout: tenantBranding?.receiptLayout ?? 'CLASSIC',
    downloadPdfReceipt: tenantBranding?.downloadPdfReceipt ?? false,
    showPoweredBy: tenantBranding?.showPoweredBy ?? true,
    currency: branch?.currency ?? 'PKR',
    timezone: branch?.timezone ?? 'Asia/Karachi',
    branchKdsEnabled: branch?.kdsEnabled ?? false,
    branchKotAutoPrint: branch?.kotAutoPrint ?? false,
    openingTime: branch?.openingTime ?? null,
    closingTime: branch?.closingTime ?? null,
    pos: {
      ...((tenant?.settings as any)?.pos ?? {}),
      orderNumberFormat: tb?.orderNumberFormat ?? 'STANDARD',
      tenantShortCode: tb?.tenantShortCode ?? null,
      tableCleaningMinutes: tb?.tableCleaningMinutes ?? 5,
      requireShiftOpen: tb?.requireShiftOpen ?? true,
      requireShiftOpening: tb?.requireShiftOpen ?? true, // POSLayout reads this alias
      allowLoginWithoutShift: tb?.allowLoginWithoutShift ?? false,
      allowOrderReopen: tb?.allowOrderReopen ?? false,
      orderReopenWindowMinutes: tb?.orderReopenWindowMinutes ?? 30,
      maxDiscountPercent: tb?.maxDiscountPercent ?? 0,
      allowCashierDiscounts: tb?.allowCashierDiscounts ?? false,
      voidRequiresManagerApproval: tb?.voidRequiresManagerApproval ?? true,
      autoKotPrint: tb?.autoKotPrint ?? true,
      autoReceiptPrint: tb?.autoReceiptPrint ?? true,
      blockOutOfStock: tb?.blockOutOfStock ?? true,
      kotEnabled: tb?.kotEnabled ?? true,
      posMarkReadyEnabled: tb?.posMarkReadyEnabled ?? true,
      staleShiftWarnHours: tb?.staleShiftWarnHours ?? 16,
      autoCloseAbandonedHours: tb?.autoCloseAbandonedHours ?? 24,
      cashCountRequired: tb?.cashCountRequired ?? true,
      varianceAlertThreshold: tb?.varianceAlertThreshold ?? 500,
      managerOverlayEnabled: tb?.managerOverlayEnabled ?? true,
      managerOverlayIdleMinutes: tb?.managerOverlayIdleMinutes ?? 5,
      managerOverlayRequireReason: tb?.managerOverlayRequireReason ?? true,
      syncBatchSize: tb?.syncBatchSize ?? 50,
      syncRequestTimeoutMs: tb?.syncRequestTimeoutMs ?? 8000,
      syncMaxEventLifetimeHours: tb?.syncMaxEventLifetimeHours ?? 24,
      shiftCloseSyncTimeoutSec: tb?.shiftCloseSyncTimeoutSec ?? 45,
      allowCloseWithUnsynced: tb?.allowCloseWithUnsynced ?? true,
      closeWithUnsyncedRequiresPin: tb?.closeWithUnsyncedRequiresPin ?? true,
    },
    orderNumberFormat: tb?.orderNumberFormat ?? 'STANDARD',
    tenantShortCode: tb?.tenantShortCode ?? null,
    tableCleaningMinutes: tb?.tableCleaningMinutes ?? 5,
    kitchen: (tenant?.settings as any)?.kitchen ?? {},
  };
}
