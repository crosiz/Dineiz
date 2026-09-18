/* Dineiz POS service worker.
 *
 * Source: apps/pos/scripts/sw.template.js. `pnpm build` runs
 * scripts/generate-sw.mjs after `next build`, which fills in the build's asset
 * list and writes the result to public/sw.js. Do not edit public/sw.js.
 *
 * What it does, and why:
 *
 *  - App shell. Every screen's HTML and every file under /_next/static is
 *    cached at install time, so a tablet that reboots with no network can still
 *    open the POS. Orders punched offline already live in IndexedDB (the event
 *    log) and ship when the API is reachable again; this worker is only what
 *    lets the app itself load.
 *
 *  - Screens are served from the cache first. The HTML is the same for every
 *    user (auth, tenant and branch are all client-side), and it only changes
 *    when a new build ships, at which point this file changes too and the whole
 *    cache is replaced as one set. Serving it from the cache is what makes
 *    opening the POS instant, and it also keeps a tablet usable on a connection
 *    that is up but not passing traffic.
 *
 *  - Next's in-app navigation data (RSC requests) is never cached: it goes to
 *    the network, and fails fast when there is none. Next then falls back to a
 *    full page load, which this worker answers from the cache.
 *
 *  - The API is on another origin and is never touched. Neither is anything
 *    else cross-origin, except menu and logo images, which are kept in a small
 *    capped cache.
 */

const BUILD = '__BUILD__';
const PRECACHE = __PRECACHE__;
const SHELLS = __SHELLS__;

const SHELL_CACHE = `dineiz-pos-shell-${BUILD}`;
const IMAGE_CACHE = 'dineiz-pos-images';
const IMAGE_CACHE_MAX = 200;
const RSC_TIMEOUT_MS = 8000;

// Paths whose response is a redirect (or that render the same screen as
// another) mapped onto the shell that actually renders.
const ALIASES = { '/': '/login', '/pos': '/pos/home' };

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Static assets are content-hashed, so a plain addAll is safe for them.
      // Batched so a slow connection does not open hundreds of requests at once.
      for (let i = 0; i < PRECACHE.length; i += 20) {
        await cache.addAll(PRECACHE.slice(i, i + 20));
      }
      // Screens are fetched one by one, bypassing the HTTP cache, and stored as
      // a clean response: a redirected Response cannot be used to answer a
      // navigation.
      for (const path of SHELLS) {
        const res = await fetch(new Request(path, { cache: 'reload', credentials: 'same-origin' }));
        if (!res.ok) throw new Error(`Precache failed for ${path}: ${res.status}`);
        await cache.put(path, await cleanResponse(res));
      }
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Drops the previous build's shell, and anything left behind by the
      // next-pwa worker this one replaced (workbox's start-url, pages,
      // next-data, cross-origin caches...). Nothing else in the app uses
      // CacheStorage: offline data lives in IndexedDB.
      const keep = new Set([SHELL_CACHE, IMAGE_CACHE]);
      const names = await caches.keys();
      await Promise.all(names.filter((n) => !keep.has(n)).map((n) => caches.delete(n)));
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.disable();
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) {
    if (req.destination === 'image') event.respondWith(handleImage(req));
    return;
  }

  if (url.pathname === '/sw.js') return;

  if (isRsc(req, url)) {
    event.respondWith(handleRsc(req));
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(handleNavigate(req, url));
    return;
  }

  if (url.pathname.startsWith('/_next/static/') || PRECACHE_SET.has(url.pathname)) {
    event.respondWith(cacheFirst(req, url.pathname));
    return;
  }

  if (req.destination === 'image') {
    event.respondWith(handleImage(req));
  }
  // Everything else (Next internals, anything not in the build) is left to the
  // browser untouched.
});

const PRECACHE_SET = new Set(PRECACHE);
const SHELL_SET = new Set(SHELLS);

function isRsc(req, url) {
  return req.headers.get('RSC') === '1' || url.searchParams.has('_rsc');
}

function shellFor(pathname) {
  const trimmed = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  const path = ALIASES[trimmed] || trimmed;
  return SHELL_SET.has(path) ? path : null;
}

async function handleNavigate(req, url) {
  const cache = await caches.open(SHELL_CACHE);
  const shell = shellFor(url.pathname);
  if (shell) {
    // The query string is read client-side (useSearchParams), so one cached
    // copy per screen serves every /pos/order?tableId=... variant.
    const hit = await cache.match(shell);
    if (hit) return hit;
  }
  try {
    const res = await fetch(req);
    if (shell && res.ok && !res.redirected) cache.put(shell, res.clone());
    return res;
  } catch (err) {
    // Unknown path with no network: land somewhere that works rather than on
    // the browser's offline page.
    const fallback = (await cache.match('/pos/home')) || (await cache.match('/login'));
    if (fallback) return fallback;
    throw err;
  }
}

async function handleRsc(req) {
  if (self.navigator && self.navigator.onLine === false) return Response.error();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RSC_TIMEOUT_MS);
  try {
    return await fetch(req, { signal: controller.signal });
  } catch {
    // A failed RSC fetch makes Next fall back to a full page load, which
    // handleNavigate answers from the cache.
    return Response.error();
  } finally {
    clearTimeout(timer);
  }
}

async function cacheFirst(req, key) {
  const cache = await caches.open(SHELL_CACHE);
  const hit = await cache.match(key);
  if (hit) return hit;
  const res = await fetch(req);
  // A static chunk that was not in the precache list (shouldn't happen, but a
  // partial deploy could) is kept once it has been seen.
  if (res.ok && key.startsWith('/_next/static/')) cache.put(key, res.clone());
  return res;
}

async function handleImage(req) {
  const cache = await caches.open(IMAGE_CACHE);
  const hit = await cache.match(req.url);
  if (hit) return hit;
  try {
    // <img> requests are no-cors, and an opaque response is charged against the
    // origin's storage quota at several MB each, whatever its real size: enough
    // of them could squeeze out the IndexedDB that holds unsynced orders. So
    // images are fetched with CORS (Cloudinary allows it) and only a readable
    // response is cached.
    const res = await fetch(req.url, { mode: 'cors', credentials: 'omit' });
    if (res.ok) {
      await cache.put(req.url, res.clone());
      trimImages(cache);
    }
    return res;
  } catch {
    try {
      return await fetch(req);
    } catch {
      return Response.error();
    }
  }
}

let trimming = false;
async function trimImages(cache) {
  if (trimming) return;
  trimming = true;
  try {
    const keys = await cache.keys();
    const excess = keys.length - IMAGE_CACHE_MAX;
    // cache.keys() is in insertion order, so the oldest go first.
    for (let i = 0; i < excess; i++) await cache.delete(keys[i]);
  } finally {
    trimming = false;
  }
}

async function cleanResponse(res) {
  if (!res.redirected) return res;
  const body = await res.blob();
  return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
}
