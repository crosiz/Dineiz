import { prisma } from '@swiftserve/db';
import { preGenerateForecastsForTenant } from '../routes/forecast/forecast.service';

export async function runForecastGeneration() {
  console.log('[FORECAST_WORKER] Starting nightly forecast generation...');

  try {
    const tenants = await prisma.tenant.findMany({
      where: { status: 'ACTIVE' }
    });

    console.log(`[FORECAST_WORKER] Found ${tenants.length} active tenants. Generating...`);

    for (const tenant of tenants) {
      try {
        await preGenerateForecastsForTenant(tenant.id);
      } catch (err) {
        console.error(`[FORECAST_WORKER] Failed generation for tenant ${tenant.id}:`, err);
      }
    }

    console.log('[FORECAST_WORKER] Forecast generation completed successfully.');
  } catch (err) {
    console.error('[FORECAST_WORKER] Critical error in forecast worker:', err);
  }
}
