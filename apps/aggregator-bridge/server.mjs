import express from "express";
import { z } from "zod";

const app = express();
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// Generic webhook relay (Foodpanda/Careem) scaffold.
// Validates shared secret and forwards payload to SwiftServe API.
const WebhookSchema = z.object({
  tenantId: z.string().min(1),
  provider: z.enum(["foodpanda", "careem"]),
  event: z.string().min(1),
  data: z.any(),
});

app.post("/webhook/:provider/:tenantId", async (req, res) => {
  const secret = req.headers["x-bridge-secret"];
  if (!process.env.BRIDGE_SECRET || secret !== process.env.BRIDGE_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const parsed = WebhookSchema.safeParse({
    ...req.body,
    provider: req.params.provider,
    tenantId: req.params.tenantId,
  });
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload" });

  const apiUrl = process.env.API_URL || "http://api:8080";
  try {
    const fwd = await fetch(`${apiUrl}/api/aggregators/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Bridge-Secret": String(process.env.BRIDGE_SECRET),
      },
      body: JSON.stringify(parsed.data),
    });
    const text = await fwd.text();
    return res.status(fwd.status).send(text);
  } catch (e) {
    return res.status(502).json({ error: "Upstream unavailable" });
  }
});

// Backward compatible endpoint: expects tenantId/provider/event in body
app.post("/webhook", async (req, res) => {
  const secret = req.headers["x-bridge-secret"];
  if (!process.env.BRIDGE_SECRET || secret !== process.env.BRIDGE_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const parsed = WebhookSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload" });

  const apiUrl = process.env.API_URL || "http://api:8080";
  try {
    const fwd = await fetch(`${apiUrl}/api/aggregators/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Bridge-Secret": String(process.env.BRIDGE_SECRET),
      },
      body: JSON.stringify(parsed.data),
    });
    const text = await fwd.text();
    return res.status(fwd.status).send(text);
  } catch (e) {
    return res.status(502).json({ error: "Upstream unavailable" });
  }
});

const port = process.env.PORT || 8092;
app.listen(port, "0.0.0.0", () => console.log(`[aggregator-bridge] listening on ${port}`));

