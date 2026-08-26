export type PlanId = 'GO_FREE' | 'GO_PRO' | 'STARTER' | 'PRO' | 'ENTERPRISE';

export interface PlanLimits {
  maxBranches: number; // -1 = unlimited
  maxStaff: number; // -1 = unlimited
  dailyOrders: number; // -1 = unlimited
  reportHistory: number; // days, -1 = unlimited
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  monthlyPrice: number | null;
  annualPrice: number | null;
  limits: PlanLimits;
}

export const PLANS: PlanDefinition[] = [
  {
    id: 'GO_FREE',
    name: 'Go Free',
    monthlyPrice: 0,
    annualPrice: 0,
    limits: { maxBranches: 1, maxStaff: 1, dailyOrders: 30, reportHistory: 1 },
  },
  {
    id: 'GO_PRO',
    name: 'Go Pro',
    monthlyPrice: 999,
    annualPrice: 9990,
    limits: { maxBranches: 1, maxStaff: 2, dailyOrders: -1, reportHistory: 30 },
  },
  {
    id: 'STARTER',
    name: 'Starter',
    monthlyPrice: 2999,
    annualPrice: 29990,
    limits: { maxBranches: 1, maxStaff: 5, dailyOrders: -1, reportHistory: 90 },
  },
  {
    id: 'PRO',
    name: 'Pro',
    monthlyPrice: 5999,
    annualPrice: 59990,
    limits: { maxBranches: 3, maxStaff: 15, dailyOrders: -1, reportHistory: 365 },
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    monthlyPrice: null,
    annualPrice: null,
    limits: { maxBranches: -1, maxStaff: -1, dailyOrders: -1, reportHistory: -1 },
  },
];

const PLAN_MAP: Record<PlanId, PlanDefinition> = Object.fromEntries(
  PLANS.map((p) => [p.id, p])
) as Record<PlanId, PlanDefinition>;

export function isValidPlan(plan: string): plan is PlanId {
  return plan in PLAN_MAP;
}

export function getPlanDefinition(plan: string): PlanDefinition {
  return PLAN_MAP[plan as PlanId] ?? PLAN_MAP.STARTER;
}

export function getPlanLimits(plan: string): PlanLimits {
  return getPlanDefinition(plan).limits;
}
