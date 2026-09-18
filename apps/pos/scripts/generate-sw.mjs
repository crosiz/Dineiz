// Writes public/sw.js from scripts/sw.template.js after `next build`.
//
// The worker needs to know every file the build produced so it can cache the
// whole app at install time. That list only exists once `next build` has run,
// so this runs as the second half of `pnpm build`. The output is gitignored.

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const nextDir = join(root, '.next');
const publicDir = join(root, 'public');

// Every screen the POS can open. Each one's HTML is cached so it can load with
// no network. `/` and `/pos` are aliases handled inside the worker.
const SHELLS = [
  '/login',
  '/pos/home',
  '/pos/order',
  '/pos/tables',
  '/pos/tickets',
  '/pos/stock',
  '/pos/kds',
  '/pos/settings',
  '/pos/admin',
  '/pos/admin/reports/shift',
  '/pos/receipt',
  '/pos/shift/open',
  '/pos/shift/close',
  '/pos/shift/synced',
];

// Screens added under app/ must be listed above, or they will not open offline.
function checkShellsCoverRoutes() {
  const appDir = join(root, 'app');
  const routes = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name === 'page.tsx' || name === 'page.ts') {
        const rel = relative(appDir, dir).split(sep).filter((s) => s && !s.startsWith('('));
        routes.push('/' + rel.join('/'));
      }
    }
  };
  walk(appDir);
  const aliases = new Set(['/', '/pos']);
  const missing = routes.filter((r) => !aliases.has(r) && !SHELLS.includes(r));
  if (missing.length) {
    throw new Error(`generate-sw: add these screens to SHELLS in scripts/generate-sw.mjs: ${missing.join(', ')}`);
  }
}

function listFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const full = join(d, name);
      if (statSync(full).isDirectory()) walk(full);
      else out.push(full);
    }
  };
  if (existsSync(dir)) walk(dir);
  return out;
}

const toUrl = (base, file, prefix) => prefix + relative(base, file).split(sep).join('/');

// `pnpm dev` runs this with --dev first. `pnpm start` and `pnpm dev` share
// port 3001, so a worker installed by a local production run would otherwise
// keep answering the dev server with that build's cached screens. The browser
// re-fetches /sw.js on every navigation; this version, once it installs,
// clears the caches, unregisters itself and reloads into the dev server.
if (process.argv.includes('--dev')) {
  writeFileSync(
    join(publicDir, 'sw.js'),
    `// Development placeholder written by scripts/generate-sw.mjs --dev. Removes any
// production worker left on this origin; never caches anything.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) await caches.delete(key);
    await self.registration.unregister();
    for (const client of await self.clients.matchAll({ type: 'window' })) client.navigate(client.url);
  })());
});
`,
  );
  process.exit(0);
}

if (!existsSync(join(nextDir, 'BUILD_ID'))) {
  throw new Error('generate-sw: .next/BUILD_ID not found. Run `next build` first.');
}
checkShellsCoverRoutes();

const buildId = readFileSync(join(nextDir, 'BUILD_ID'), 'utf8').trim();

const staticUrls = listFiles(join(nextDir, 'static'))
  .filter((f) => !f.endsWith('.map'))
  .map((f) => toUrl(join(nextDir, 'static'), f, '/_next/static/'));

const publicUrls = listFiles(publicDir)
  .map((f) => toUrl(publicDir, f, '/'))
  .filter((u) => u !== '/sw.js');

// app/icon.svg is served by Next as a route, not from public/.
const routeAssets = existsSync(join(root, 'app', 'icon.svg')) ? ['/icon.svg'] : [];

const precache = [...publicUrls, ...routeAssets, ...staticUrls].sort();

// The cache name changes whenever anything in the build does, which is what
// retires the previous build's cache on activate.
const version = createHash('sha256')
  .update(buildId)
  .update(precache.join('\n'))
  .update(SHELLS.join('\n'))
  .digest('hex')
  .slice(0, 12);

const template = readFileSync(join(root, 'scripts', 'sw.template.js'), 'utf8');
const sw = template
  .replace("'__BUILD__'", JSON.stringify(version))
  .replace('__PRECACHE__', JSON.stringify(precache))
  .replace('__SHELLS__', JSON.stringify(SHELLS));

writeFileSync(join(publicDir, 'sw.js'), sw);

const bytes = [...listFiles(join(nextDir, 'static')), ...listFiles(publicDir)]
  .filter((f) => !f.endsWith('.map') && !f.endsWith(`${sep}sw.js`))
  .reduce((n, f) => n + statSync(f).size, 0);
console.log(
  `generate-sw: public/sw.js (${version}), ${precache.length} files + ${SHELLS.length} screens, ` +
    `${(bytes / 1024 / 1024).toFixed(1)} MB precached`,
);
