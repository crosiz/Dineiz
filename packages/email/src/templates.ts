import { buildEmail, BuiltEmail } from './shell';

export interface EmailContent extends BuiltEmail {
  subject: string;
}

const DASHBOARD_URL = 'https://console.dineiz.com/login';

export function welcomeEmail(params: {
  ownerName: string;
  restaurantName: string;
  email: string;
  password: string;
  plan: string;
  trialEndsAt?: string;
  branchCodes: { branchName: string; code: string }[];
}): EmailContent {
  const { ownerName, restaurantName, email, password, plan, trialEndsAt, branchCodes } = params;
  return {
    subject: `Welcome to Dineiz, ${restaurantName}`,
    ...buildEmail({
      preheaderText: `Your Dineiz account for ${restaurantName} is ready.`,
      headline: 'Welcome to Dineiz',
      bodyParagraphs: [
        `Hi ${ownerName},`,
        `Your Dineiz account for <strong>${restaurantName}</strong> is ready. Use the credentials below to sign in to your dashboard.`,
        ...(trialEndsAt ? [`Your ${plan} trial runs until ${trialEndsAt}.`] : []),
      ],
      detailRows: [
        { label: 'Login URL', value: 'console.dineiz.com' },
        { label: 'Email', value: email },
        { label: 'Password', value: password },
        { label: 'Plan', value: plan },
        ...branchCodes.map((b) => ({ label: b.branchName, value: b.code })),
      ],
      primaryAction: { label: 'Open your dashboard', url: DASHBOARD_URL },
    }),
  };
}

export function trialReminderEmail(params: {
  ownerName: string;
  restaurantName: string;
  daysLeft: 7 | 3 | 1;
  trialEndsAt: string;
  billingUrl: string;
}): EmailContent {
  const { ownerName, restaurantName, daysLeft, trialEndsAt, billingUrl } = params;
  const headline =
    daysLeft === 1 ? 'Your trial ends tomorrow' : `Your trial ends in ${daysLeft} days`;
  return {
    subject: `${restaurantName} — ${headline}`,
    ...buildEmail({
      preheaderText: headline,
      headline,
      bodyParagraphs: [
        `Hi ${ownerName},`,
        `Your Dineiz trial ends on ${trialEndsAt}. To keep access to your POS, dashboard, and reports, choose a plan before then.`,
      ],
      primaryAction: { label: daysLeft === 7 ? 'View plans' : 'Continue your plan', url: billingUrl },
    }),
  };
}

export function trialExtendedEmail(params: {
  ownerName: string;
  restaurantName: string;
  newTrialEndsAt: string;
}): EmailContent {
  const { ownerName, restaurantName, newTrialEndsAt } = params;
  return {
    subject: `${restaurantName} — Your trial has been extended`,
    ...buildEmail({
      preheaderText: 'Your trial has been extended.',
      headline: 'Your trial has been extended',
      bodyParagraphs: [
        `Hi ${ownerName},`,
        `Your Dineiz trial has been extended. It now ends on ${newTrialEndsAt}.`,
      ],
      primaryAction: { label: 'Open your dashboard', url: DASHBOARD_URL },
    }),
  };
}

export function trialEndedEmail(params: {
  ownerName: string;
  restaurantName: string;
  billingUrl: string;
}): EmailContent {
  const { ownerName, restaurantName, billingUrl } = params;
  return {
    subject: `${restaurantName} — Your trial has ended`,
    ...buildEmail({
      preheaderText: 'Your trial has ended.',
      headline: 'Your trial has ended',
      bodyParagraphs: [
        `Hi ${ownerName},`,
        `Your Dineiz trial for ${restaurantName} has ended. Choose a plan to keep using your POS, dashboard, and reports.`,
      ],
      primaryAction: { label: 'Choose a plan', url: billingUrl },
    }),
  };
}

export function paymentReceivedEmail(params: {
  ownerName: string;
  restaurantName: string;
  amount: string;
  method: string;
  periodStart: string;
  periodEnd: string;
  billingUrl: string;
}): EmailContent {
  const { ownerName, restaurantName, amount, method, periodStart, periodEnd, billingUrl } = params;
  return {
    subject: `${restaurantName} — Payment received`,
    ...buildEmail({
      preheaderText: `We received your payment of ${amount}.`,
      headline: 'Payment received',
      bodyParagraphs: [`Hi ${ownerName},`, `We received your payment for ${restaurantName}. Your subscription is active.`],
      detailRows: [
        { label: 'Amount', value: amount },
        { label: 'Method', value: method },
        { label: 'Period', value: `${periodStart} – ${periodEnd}` },
      ],
      primaryAction: { label: 'View billing', url: billingUrl },
    }),
  };
}

export function renewalReminderEmail(params: {
  ownerName: string;
  restaurantName: string;
  amount: string;
  dueDate: string;
  billingUrl: string;
}): EmailContent {
  const { ownerName, restaurantName, amount, dueDate, billingUrl } = params;
  return {
    subject: `${restaurantName} — Your subscription renews soon`,
    ...buildEmail({
      preheaderText: `Your subscription renews on ${dueDate}.`,
      headline: 'Your subscription renews soon',
      bodyParagraphs: [
        `Hi ${ownerName},`,
        `Your Dineiz subscription for ${restaurantName} renews on ${dueDate} for ${amount}.`,
      ],
      primaryAction: { label: 'View billing', url: billingUrl },
    }),
  };
}

export function paymentFailedEmail(params: {
  ownerName: string;
  restaurantName: string;
  amount: string;
  gracePeriodDays: number;
  billingUrl: string;
}): EmailContent {
  const { ownerName, restaurantName, amount, gracePeriodDays, billingUrl } = params;
  return {
    subject: `${restaurantName} — Payment required`,
    ...buildEmail({
      preheaderText: 'Your subscription payment is due.',
      headline: 'Payment required',
      bodyParagraphs: [
        `Hi ${ownerName},`,
        `Your payment of ${amount} for ${restaurantName} was not received. You have ${gracePeriodDays} days to complete payment before access is limited.`,
      ],
      primaryAction: { label: 'Complete payment', url: billingUrl },
    }),
  };
}

export function suspensionWarningEmail(params: {
  ownerName: string;
  restaurantName: string;
  daysLeft: number;
  billingUrl: string;
}): EmailContent {
  const { ownerName, restaurantName, daysLeft, billingUrl } = params;
  return {
    subject: `${restaurantName} — Account access ending soon`,
    ...buildEmail({
      preheaderText: 'Your account access is ending soon.',
      headline: 'Account access ending soon',
      bodyParagraphs: [
        `Hi ${ownerName},`,
        `Your Dineiz account for ${restaurantName} will be suspended in ${daysLeft} day${daysLeft === 1 ? '' : 's'} unless payment is completed.`,
      ],
      primaryAction: { label: 'Complete payment', url: billingUrl },
    }),
  };
}

export function suspendedEmail(params: {
  ownerName: string;
  restaurantName: string;
  billingUrl: string;
}): EmailContent {
  const { ownerName, restaurantName, billingUrl } = params;
  return {
    subject: `${restaurantName} — Account suspended`,
    ...buildEmail({
      preheaderText: 'Your account has been suspended.',
      headline: 'Account suspended',
      bodyParagraphs: [
        `Hi ${ownerName},`,
        `Your Dineiz account for ${restaurantName} has been suspended due to non-payment. New orders are blocked until payment is completed. Your data is safe and reports remain available for export.`,
      ],
      primaryAction: { label: 'Reactivate', url: billingUrl },
    }),
  };
}

export function reactivatedEmail(params: {
  ownerName: string;
  restaurantName: string;
}): EmailContent {
  const { ownerName, restaurantName } = params;
  return {
    subject: `${restaurantName} — Your account is active again`,
    ...buildEmail({
      preheaderText: 'Your account is active again.',
      headline: 'Your account is active again',
      bodyParagraphs: [`Hi ${ownerName},`, `Your Dineiz account for ${restaurantName} is active again. Full access has been restored.`],
      primaryAction: { label: 'Open your dashboard', url: DASHBOARD_URL },
    }),
  };
}

export function planChangedEmail(params: {
  ownerName: string;
  restaurantName: string;
  oldPlan: string;
  newPlan: string;
  effectiveDate: string;
  planUrl: string;
}): EmailContent {
  const { ownerName, restaurantName, oldPlan, newPlan, effectiveDate, planUrl } = params;
  return {
    subject: `${restaurantName} — Your plan has been updated`,
    ...buildEmail({
      preheaderText: `Your plan is now ${newPlan}.`,
      headline: 'Your plan has been updated',
      bodyParagraphs: [`Hi ${ownerName},`, `Your Dineiz plan for ${restaurantName} has changed, effective ${effectiveDate}.`],
      detailRows: [
        { label: 'Previous plan', value: oldPlan },
        { label: 'New plan', value: newPlan },
      ],
      primaryAction: { label: 'View plan details', url: planUrl },
    }),
  };
}

export function managerInviteEmail(params: {
  managerName: string;
  restaurantName: string;
  branchName: string;
  email: string;
  temporaryPassword: string;
}): EmailContent {
  const { managerName, restaurantName, branchName, email, temporaryPassword } = params;
  return {
    subject: `You've been added as a manager — ${restaurantName}`,
    ...buildEmail({
      preheaderText: `You have been added as a manager for ${restaurantName}.`,
      headline: 'You have been added as a manager',
      bodyParagraphs: [
        `Hi ${managerName},`,
        `You have been added as a manager for <strong>${restaurantName}</strong> at <strong>${branchName}</strong>. Use the credentials below to sign in.`,
      ],
      detailRows: [
        { label: 'Login URL', value: 'console.dineiz.com' },
        { label: 'Email', value: email },
        { label: 'Temporary password', value: temporaryPassword },
      ],
      primaryAction: { label: 'Sign in', url: DASHBOARD_URL },
    }),
  };
}

export function passwordResetEmail(params: {
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
}): EmailContent {
  const { name, resetUrl, expiresInMinutes } = params;
  return {
    subject: 'Reset your Dineiz password',
    ...buildEmail({
      preheaderText: 'Reset your password.',
      headline: 'Reset your password',
      bodyParagraphs: [
        `Hi ${name},`,
        `You requested a password reset. This link expires in ${expiresInMinutes} minutes. If you did not request this, ignore this email — your password will not change.`,
      ],
      primaryAction: { label: 'Reset password', url: resetUrl },
    }),
  };
}

export function branchCreatedEmail(params: {
  ownerName: string;
  restaurantName: string;
  branchName: string;
  branchCode: string;
  address: string;
}): EmailContent {
  const { ownerName, restaurantName, branchName, branchCode, address } = params;
  return {
    subject: `${restaurantName} — New branch added: ${branchName}`,
    ...buildEmail({
      preheaderText: `${branchName} has been added to your account.`,
      headline: 'New branch added',
      bodyParagraphs: [`Hi ${ownerName},`, `A new branch has been added to your Dineiz account for ${restaurantName}.`],
      detailRows: [
        { label: 'Branch', value: branchName },
        { label: 'Branch code', value: branchCode },
        ...(address ? [{ label: 'Address', value: address }] : []),
      ],
      primaryAction: { label: 'Open your dashboard', url: DASHBOARD_URL },
    }),
  };
}
