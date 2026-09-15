import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import node from '@astrojs/node';

// This app has no meaningful "static" version of itself — every page read depends on the
// scanned QR code's own tenantId/branchId/table query params, so it must render on demand.
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [react()],
});

