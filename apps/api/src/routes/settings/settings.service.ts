import { prisma } from '@dineiz/db';
import { uploadImage } from '../../lib/cloudinary';
import { getIO, emitBrandingUpdated } from '../../lib/socket';
import { defaultQueue } from '../../lib/queue';
import bcrypt from 'bcryptjs';

// ─── Branding helpers ─────────────────────────────────────────────────────────

/** Default branding shape returned when no TenantBranding row exists yet */
function defaultBranding(restaurantName: string, primaryColor: string, logoUrl?: string | null) {
  return {
    restaurantName,
    primaryColor,
    secondaryColor: '#1A1A2E',
    accentColor: '#FFB300',
    logoUrl: logoUrl ?? null,
    tagline: null,
    businessType: 'Fine Dining',
    phone: null,
    website: null,
    // Tax
    cashTaxEnabled: true,
    cashTaxRate: 5,
    cashTaxLabel: 'GST (Cash)',
    cardTaxEnabled: true,
    cardTaxRate: 17,
    cardTaxLabel: 'GST (Card/Digital)',
    showDualTaxOnReceipt: true,
    cashTaxNote: null,
    cardTaxNote: null,
    taxRoundingMethod: 'ROUND',
    // Service charge
    serviceChargeEnabled: false,
    serviceChargeRate: 10,
    // FBR
    fbrEnabled: false,
    fbrNtn: null,
    fbrPosId: null,
    fbrInvoicePrefix: null,
    fbrSrb: false,
    taxAuthority: 'FBR',
    // Receipt
    receiptHeader: null,
    receiptFooter: null,
    showLogoOnReceipt: true,
    showTaxBreakdown: true,
    showTokenNumber: false,
    showCashierName: false,
    showTableNumber: false,
    receiptLanguage: 'English (US)',
    receiptPaperSize: '80mm',
    receiptCopies: 1,
    showFbrLogo: true,
    showQrCode: true,
    showNtn: true,
    receiptDisclaimer: null,
    cashPaymentNote: null,
    cardPaymentNote: null,
  };
}

export async function getTenantBranding(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, colorPrimary: true, colorSecondary: true, logoUrl: true },
  });
  if (!tenant) return null;

  const branding = await prisma.tenantBranding.findUnique({ where: { tenantId } });
  if (!branding) {
    return defaultBranding(tenant.name, tenant.colorPrimary, tenant.logoUrl);
  }

  return {
    restaurantName: branding.restaurantName || tenant.name,
    tagline: branding.tagline,
    businessType: branding.businessType,
    phone: branding.phone,
    website: branding.website,
    primaryColor: branding.primaryColor,
    secondaryColor: branding.secondaryColor,
    accentColor: branding.accentColor,
    logoUrl: branding.logoUrl,
    // Tax (dual)
    cashTaxEnabled: branding.cashTaxEnabled,
    cashTaxRate: branding.cashTaxRate,
    cashTaxLabel: branding.cashTaxLabel,
    cardTaxEnabled: branding.cardTaxEnabled,
    cardTaxRate: branding.cardTaxRate,
    cardTaxLabel: branding.cardTaxLabel,
    showDualTaxOnReceipt: branding.showDualTaxOnReceipt,
    cashTaxNote: branding.cashTaxNote,
    cardTaxNote: branding.cardTaxNote,
    taxRoundingMethod: branding.taxRoundingMethod,
    // Service charge
    serviceChargeEnabled: branding.serviceChargeEnabled,
    serviceChargeRate: branding.serviceChargeRate,
    // FBR
    fbrEnabled: branding.fbrEnabled,
    fbrNtn: branding.fbrNtn,
    fbrPosId: branding.fbrPosId,
    fbrInvoicePrefix: branding.fbrInvoicePrefix,
    fbrSrb: branding.fbrSrb,
    taxAuthority: branding.taxAuthority,
    // Receipt
    receiptHeader: branding.receiptHeader,
    receiptFooter: branding.receiptFooter,
    showLogoOnReceipt: branding.showLogoOnReceipt,
    showTaxBreakdown: branding.showTaxBreakdown,
    showTokenNumber: branding.showTokenNumber,
    showTableNumber: branding.showTableNumber,
    receiptLanguage: branding.receiptLanguage,
    receiptPaperSize: branding.receiptPaperSize,
    receiptLayout: branding.receiptLayout,
    downloadPdfReceipt: branding.downloadPdfReceipt,
    receiptCopies: branding.receiptCopies,
    showFbrLogo: branding.showFbrLogo,
    showQrCode: branding.showQrCode,
    showNtn: branding.showNtn,
    receiptDisclaimer: branding.receiptDisclaimer,
    cashPaymentNote: branding.cashPaymentNote,
    cardPaymentNote: branding.cardPaymentNote,
    cashShowTendered: branding.cashShowTendered,
    cashShowChange: branding.cashShowChange,
    cardShowMethod: branding.cardShowMethod,
    showPoweredBy: branding.showPoweredBy,
    kotEnabled: branding.kotEnabled,
    posMarkReadyEnabled: branding.posMarkReadyEnabled,
    cashEnabled: branding.cashEnabled,
    cardEnabled: branding.cardEnabled,
    jazzcashEnabled: branding.jazzcashEnabled,
    easypaisaEnabled: branding.easypaisaEnabled,
    discountLimit: branding.discountLimit,
    voidRequiresManagerApproval: branding.voidRequiresManagerApproval,
  };
}

export async function updateTenantBranding(tenantId: string, data: any) {
  const brandingData: any = {};

  // Identity fields
  if (data.restaurantName != null) brandingData.restaurantName = data.restaurantName;
  if (data.tagline != null) brandingData.tagline = data.tagline;
  if (data.businessType != null) brandingData.businessType = data.businessType;
  if (data.phone != null) brandingData.phone = data.phone;
  if (data.website != null) brandingData.website = data.website;

  // Visual
  if (data.primaryColor != null) brandingData.primaryColor = data.primaryColor;
  if (data.secondaryColor != null) brandingData.secondaryColor = data.secondaryColor;
  if (data.accentColor != null) brandingData.accentColor = data.accentColor;
  if (data.logoUrl != null) brandingData.logoUrl = data.logoUrl;

  // Dual tax
  if (data.cashTaxEnabled != null) brandingData.cashTaxEnabled = Boolean(data.cashTaxEnabled);
  if (data.cashTaxRate != null) brandingData.cashTaxRate = Number(data.cashTaxRate);
  if (data.cashTaxLabel != null) brandingData.cashTaxLabel = data.cashTaxLabel;
  if (data.cardTaxEnabled != null) brandingData.cardTaxEnabled = Boolean(data.cardTaxEnabled);
  if (data.cardTaxRate != null) brandingData.cardTaxRate = Number(data.cardTaxRate);
  if (data.cardTaxLabel != null) brandingData.cardTaxLabel = data.cardTaxLabel;
  if (data.showDualTaxOnReceipt != null) brandingData.showDualTaxOnReceipt = Boolean(data.showDualTaxOnReceipt);
  if (data.cashTaxNote != null) brandingData.cashTaxNote = data.cashTaxNote;
  if (data.cardTaxNote != null) brandingData.cardTaxNote = data.cardTaxNote;
  if (data.taxRoundingMethod != null) brandingData.taxRoundingMethod = data.taxRoundingMethod;

  // Service charge
  if (data.serviceChargeEnabled != null) brandingData.serviceChargeEnabled = Boolean(data.serviceChargeEnabled);
  if (data.serviceChargeRate != null) brandingData.serviceChargeRate = Number(data.serviceChargeRate);

  // FBR
  if (data.fbrEnabled != null) brandingData.fbrEnabled = Boolean(data.fbrEnabled);
  if (data.fbrNtn != null) brandingData.fbrNtn = data.fbrNtn;
  if (data.fbrPosId != null) brandingData.fbrPosId = data.fbrPosId;
  if (data.fbrInvoicePrefix != null) brandingData.fbrInvoicePrefix = data.fbrInvoicePrefix;

  // Receipt
  if (data.receiptHeader != null) brandingData.receiptHeader = data.receiptHeader;
  if (data.receiptFooter != null) brandingData.receiptFooter = data.receiptFooter;
  if (data.showLogoOnReceipt != null) brandingData.showLogoOnReceipt = Boolean(data.showLogoOnReceipt);
  if (data.showTaxBreakdown != null) brandingData.showTaxBreakdown = Boolean(data.showTaxBreakdown);
  if (data.showCashierName != null) brandingData.showCashierName = Boolean(data.showCashierName);
  if (data.showTableNumber != null) brandingData.showTableNumber = Boolean(data.showTableNumber);
  if (data.receiptLanguage != null) brandingData.receiptLanguage = data.receiptLanguage;
  if (data.receiptPaperSize != null) brandingData.receiptPaperSize = data.receiptPaperSize;
  if (data.receiptLayout != null) brandingData.receiptLayout = data.receiptLayout;
  if (data.downloadPdfReceipt != null) brandingData.downloadPdfReceipt = Boolean(data.downloadPdfReceipt);
  if (data.showNtn != null) brandingData.showNtn = Boolean(data.showNtn);
  if (data.receiptDisclaimer != null) brandingData.receiptDisclaimer = data.receiptDisclaimer;
  if (data.cashPaymentNote != null) brandingData.cashPaymentNote = data.cashPaymentNote;
  if (data.cardPaymentNote !== undefined) brandingData.cardPaymentNote = data.cardPaymentNote;
  
  if (data.cashShowTendered != null) brandingData.cashShowTendered = Boolean(data.cashShowTendered);
  if (data.cashShowChange != null) brandingData.cashShowChange = Boolean(data.cashShowChange);
  if (data.cardShowMethod != null) brandingData.cardShowMethod = Boolean(data.cardShowMethod);
  if (data.showPoweredBy != null) brandingData.showPoweredBy = Boolean(data.showPoweredBy);

  // New strict config fields
  if (data.kotEnabled != null) brandingData.kotEnabled = Boolean(data.kotEnabled);
  if (data.posMarkReadyEnabled != null) brandingData.posMarkReadyEnabled = Boolean(data.posMarkReadyEnabled);
  if (data.cashEnabled != null) brandingData.cashEnabled = Boolean(data.cashEnabled);
  if (data.cardEnabled != null) brandingData.cardEnabled = Boolean(data.cardEnabled);
  if (data.jazzcashEnabled != null) brandingData.jazzcashEnabled = Boolean(data.jazzcashEnabled);
  if (data.easypaisaEnabled != null) brandingData.easypaisaEnabled = Boolean(data.easypaisaEnabled);
  if (data.discountLimit != null) brandingData.discountLimit = Number(data.discountLimit);
  if (data.voidRequiresManagerApproval != null) brandingData.voidRequiresManagerApproval = Boolean(data.voidRequiresManagerApproval);

  let branding = await prisma.tenantBranding.findUnique({ where: { tenantId } });
  branding = await prisma.tenantBranding.upsert({
    where: { tenantId },
    create: { tenantId, ...brandingData },
    update: brandingData,
  });

  // Also update the tenant's root color/logo for legacy compatibility
  if (data.restaurantName || data.primaryColor || data.logoUrl) {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(data.restaurantName && { name: data.restaurantName }),
        ...(data.primaryColor && { colorPrimary: data.primaryColor }),
        ...(data.logoUrl && { logoUrl: data.logoUrl }),
      },
    });
  }

  // Broadcast branding update to all POS terminals. Uses the dedicated
  // 'tenant:branding_updated' event (see emitBrandingUpdated) rather than
  // 'tenant:settings_updated' — that event is also used by
  // updateTenantSettings() below for the unrelated general tenant.settings
  // blob (kitchen/printing toggles etc.), and the POS's branding-aware
  // listener (POSLayout's handleBrandingUpdated, which pushes tax-rate
  // changes into the reactive branding store and cart session) was written
  // against 'tenant:branding_updated' and never actually fired while this
  // emitted the other event name — settings changes silently did not
  // reach the live branding store until the next full page load.
  // emitBrandingUpdated's declared param type is narrower (string | undefined
  // fields) than the full TenantBranding row (nullable DB columns come back
  // as string | null) — it just forwards whatever object it's given over
  // the socket, so this is a real type shape gap, not a runtime concern.
  emitBrandingUpdated(tenantId, branding as Record<string, any>);

  return branding;
}

export async function uploadBrandingImage(tenantId: string, type: string, buffer: Buffer, mimeType: string = 'image/png') {
  const base64 = buffer.toString('base64');
  const dataURI = `data:${mimeType};base64,${base64}`;

  const { v2: cloudinary } = require('cloudinary');
  
  const result = await cloudinary.uploader.upload(dataURI, {
    folder: `dineiz/${tenantId}/branding`,
    public_id: type,
    overwrite: true,
    transformation: type === 'logo'
      ? [{ width: 400, height: 400, crop: 'fit' }]
      : type === 'favicon'
      ? [{ width: 32, height: 32, crop: 'fill' }]
      : undefined
  });

  return { url: result.secure_url };
}

// General Settings
export async function getTenantSettings(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true, name: true }
  });
  return tenant;
}

export async function updateTenantSettings(tenantId: string, data: any) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  const currentSettings = (tenant?.settings as any) || {};
  
  const updated = await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      settings: {
        ...currentSettings,
        ...data
      }
    }
  });

  if (data.general && data.general.businessName) {
    const businessName = data.general.businessName;
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { name: businessName }
    });
    
    await prisma.tenantBranding.upsert({
      where: { tenantId },
      create: { tenantId, restaurantName: businessName },
      update: { restaurantName: businessName },
    });
  }
  
  const io = getIO();
  if (io) {
    io.of('/pos').emit('tenant:settings_updated', updated.settings);
  }

  return updated.settings;
}

// User Settings
export async function getUserSettings(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      notificationPreferences: true,
      twoFactorEnabled: true,
    }
  });
}

export async function updateNotificationPreferences(userId: string, preferences: any) {
  return prisma.user.update({
    where: { id: userId },
    data: { notificationPreferences: preferences }
  });
}

export async function toggle2FA(userId: string, enabled: boolean) {
  return prisma.user.update({
    where: { id: userId },
    data: { twoFactorEnabled: enabled }
  });
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const account = await prisma.account.findFirst({
    where: { userId, providerId: 'credential' }
  });

  if (!account || !account.password) {
    throw new Error('User does not have a password set.');
  }

  const isValid = await bcrypt.compare(currentPassword, account.password);
  if (!isValid) {
    throw new Error('Current password is incorrect');
  }

  const hashedNew = await bcrypt.hash(newPassword, 10);
  await prisma.account.update({
    where: { id: account.id },
    data: { password: hashedNew }
  });

  return { success: true };
}

export async function getActiveSessions(userId: string) {
  return prisma.session.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' }
  });
}

export async function revokeSession(sessionId: string, userId: string) {
  return prisma.session.deleteMany({
    where: { id: sessionId, userId }
  });
}

export async function revokeAllOtherSessions(currentSessionId: string, userId: string) {
  return prisma.session.deleteMany({
    where: {
      userId,
      id: { not: currentSessionId }
    }
  });
}

// Export Data Job
export async function queueExportDataJob(tenantId: string, email: string) {
  const job = await defaultQueue.add('export-data', { tenantId, email });
  return job.id;
}
