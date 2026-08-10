import { usePlan } from "@/contexts/plan-context";

export function usePlanFeature() {
  const { plan, overrides, loading } = usePlan();

  const hasFeature = (featureKey: string): boolean => {
    if (loading || !plan) return false;

    // Check for override first
    const override = overrides.find(o => o.featureKey === featureKey);
    if (override) {
      if (override.enabled !== undefined && override.enabled !== null) return override.enabled;
      if (override.value === 'true') return true;
      if (override.value === 'false') return false;
    }

    // Fallback to plan definition
    const features = plan.features || {};
    return !!features[featureKey];
  };

  const getLimit = (limitKey: string): number => {
    if (loading || !plan) return 0;

    // Check for override
    const override = overrides.find(o => o.featureKey === limitKey);
    if (override) {
      if (override.limit !== undefined && override.limit !== null) return override.limit;
      if (!isNaN(Number(override.value))) return Number(override.value);
    }

    // Fallback to plan
    const limits = plan.limits || {};
    return limits[limitKey] !== undefined ? limits[limitKey] : 0;
  };

  return { hasFeature, getLimit, loading, planName: plan?.name };
}
