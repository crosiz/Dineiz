import express from "express";
import puppeteer from "puppeteer";

const app = express();
// A full shift report — every order plus the complete activity log — can run
// to a few hundred KB of HTML on a busy day, and a whole-month export more.
// 2mb was tight enough that a long shift silently 413'd.
app.use(express.json({ limit: "16mb" }));

// ─── Browser pool ─────────────────────────────────────────────────────────────
// Launching Chromium per request cost ~6-8s, most of it startup, which is the
// difference between "Download PDF" feeling instant and feeling broken. One
// browser is kept alive and each request gets its own page (and its own
// isolated context, so pages can't see each other's cookies or storage).
let browserPromise = null;

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer
      .launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] })
      .catch((err) => {
        // Don't cache a failed launch — the next request should retry rather
        // than reject forever against a poisoned promise.
        browserPromise = null;
        throw err;
      });
  }
  const browser = await browserPromise;
  // A crashed browser leaves a resolved-but-dead promise behind; relaunch.
  if (!browser.connected) {
    browserPromise = null;
    return getBrowser();
  }
  return browser;
}

app.get("/health", async (_req, res) => {
  try {
    const browser = await getBrowser();
    res.json({ status: "ok", browser: browser.connected ? "ready" : "disconnected" });
  } catch (err) {
    res.status(503).json({ status: "error", message: err.message });
  }
});

// POST /render-invoice { html: "<html>...</html>" } -> PDF bytes
app.post("/render-invoice", async (req, res) => {
  const html = req.body?.html;
  if (!html || typeof html !== "string") return res.status(400).json({ error: "html required" });

  let context;
  try {
    const browser = await getBrowser();
    context = await browser.createBrowserContext();
    const page = await context.newPage();

    // networkidle0 waits for every image to settle. A tenant logo pointing at a
    // dead URL would otherwise hang the request until Puppeteer's default 30s
    // timeout; 15s is well past a healthy render and short enough that a broken
    // asset degrades to a missing image instead of a failed download.
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 15_000 })
      .catch(() => page.setContent(html, { waitUntil: "domcontentloaded" }));

    const pdf = await page.pdf({ format: "A4", printBackground: true });
    res.setHeader("Content-Type", "application/pdf");
    // Puppeteer's page.pdf() returns a Uint8Array, not a Node Buffer. Express's
    // res.send() only treats actual Buffer instances as binary — anything else
    // falls through to JSON serialization, corrupting the response. Wrap it.
    res.send(Buffer.from(pdf));
  } catch (err) {
    console.error("[pdf-worker] render failed:", err?.message ?? err);
    if (!res.headersSent) res.status(500).json({ error: err?.message ?? "render failed" });
  } finally {
    // Closing the context frees the page without tearing down the browser.
    await context?.close().catch(() => {});
  }
});

const port = process.env.PORT || 8091;
app.listen(port, "0.0.0.0", () => console.log(`[pdf-worker] listening on ${port}`));

// Warm the browser at boot so the first PDF of the day isn't the slow one.
getBrowser().catch((e) => console.error("[pdf-worker] browser warmup failed:", e?.message ?? e));

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    try {
      const browser = await browserPromise;
      await browser?.close();
    } catch { /* shutting down anyway */ }
    process.exit(0);
  });
}
