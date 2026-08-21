import express from "express";
import puppeteer from "puppeteer";

const app = express();
// A full shift report — every order plus the complete activity log — can run
// to a few hundred KB of HTML on a busy day, and a whole-month export more.
// 2mb was tight enough that a long shift silently 413'd.
app.use(express.json({ limit: "16mb" }));

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// POST /render-invoice { html: "<html>...</html>" } -> PDF bytes
app.post("/render-invoice", async (req, res) => {
  const html = req.body?.html;
  if (!html || typeof html !== "string") return res.status(400).json({ error: "html required" });

  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({ format: "A4", printBackground: true });
    res.setHeader("Content-Type", "application/pdf");
    // Puppeteer's page.pdf() returns a Uint8Array, not a Node Buffer. Express's
    // res.send() only treats actual Buffer instances as binary — anything else
    // falls through to JSON serialization, corrupting the response. Wrap it.
    res.send(Buffer.from(pdf));
  } finally {
    await browser.close();
  }
});

const port = process.env.PORT || 8091;
app.listen(port, "0.0.0.0", () => console.log(`[pdf-worker] listening on ${port}`));

