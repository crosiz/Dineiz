# Dineiz POS — Recommended Tech Stack (2026)

> A full-system technology recommendation for Dineiz POS, covering every layer from frontend to deployment. Each choice is justified against the PRD's requirements: multi-tenant SaaS, offline-first, real-time KDS, sub-500ms order sync, 10,000 concurrent tenants, and South Asian/MENA market constraints.

---

## 1. Frontend — POS Tablet App

### Primary Framework: **Next.js 15 (App Router) + React 19**

The POS web app is delivered as a **Progressive Web App (PWA)** installed on Android tablets. Next.js 15 with React 19's concurrent rendering handles the high-frequency state updates on the order punching screen (every item tap triggers a cart re-render) without layout thrash.

**Why not plain React or Vite?**
Next.js gives built-in PWA support via `next-pwa`, server-side rendering for the admin dashboard's SEO-facing pages, and API route co-location for lightweight BFF (backend-for-frontend) patterns. React 19's `useOptimistic` hook is used specifically for the order cart — the UI reflects taps instantly while the sync happens in the background, which is critical for offline mode.

### Styling: **Tailwind CSS v4**

Tailwind v4 (oxide engine) compiles CSS in milliseconds and ships zero dead CSS to the tablet. The design system tokens from `Design.md` are registered as Tailwind CSS variables, so `bg-brand-primary` maps to `--color-brand-primary` automatically. RTL support is handled via Tailwind's `rtl:` variant.

### State Management: **Zustand + TanStack Query v5**

- **Zustand** manages local UI state: cart contents, active order, KDS filter state, shift status. It's tiny (~1KB), has no boilerplate, and persists to IndexedDB for offline mode via `zustand/middleware/persist`.
- **TanStack Query v5** handles all server state: menus, orders, reports. It provides background refetch, stale-while-revalidate, and optimistic updates out of the box.

### Offline Sync: **Workbox 8 + IndexedDB (via Dexie.js)**

The PRD's offline-first requirement is the most technically demanding constraint. The architecture:

1. **Dexie.js** wraps IndexedDB with a clean Promise API. All orders, menu items, and session data are written to IndexedDB first.
2. **Workbox 8** (via `next-pwa`) manages the service worker lifecycle, background sync queue, and cache-first strategies for static assets and menu data.
3. On reconnect, a **background sync queue** replays all offline mutations to the backend API in order, with conflict detection.

### Form Handling: **React Hook Form + Zod**

All menu management, inventory setup, and shift forms use React Hook Form (zero re-renders on typing) with Zod schemas for runtime validation. The same Zod schemas are shared between frontend and backend via a shared `packages/schemas` monorepo package.

### Thermal Printing: **@node-escpos/core (via Electron sidecar or WebUSB)**

For receipt and KOT printing, two modes:
- **WebUSB API** (Chrome/Android tablet native): print directly from the PWA to USB thermal printers without any driver. Covers 90%+ of ESC/POS printers.
- **Electron sidecar** (Windows POS terminals): a lightweight Electron shell that exposes a local HTTP endpoint the PWA calls to trigger node-escpos print jobs.

---

## 2. Frontend — Admin Dashboard

### Same Stack: **Next.js 15 + React 19 + Tailwind CSS v4**

The admin dashboard lives in the same Next.js monorepo as the POS app (`/apps/dashboard`). It shares the design system, component library, and Zod validation schemas.

### Charts & Analytics: **Recharts + Observable Plot**

- **Recharts** for standard operational charts: revenue trend lines, order heatmaps, bar comparisons. It's React-native, tree-shakeable, and renders SVG (no canvas flickering on tablets).
- **Observable Plot** for advanced BI views: the AI demand forecast chart, geospatial delivery zone overlays, and custom scatter plots in the Pro/Enterprise tier. Observable Plot is the 2025–2026 standard for data-heavy declarative visualization.

### Data Tables: **TanStack Table v9**

Virtual scrolling via `@tanstack/virtual` handles inventory lists and order history logs with 10,000+ rows without performance degradation.

---

## 3. Frontend — Mobile Apps (Rider App + Manager App)

### Framework: **Expo 52 (React Native)**

Expo SDK 52 with the New Architecture (Fabric renderer + JSI) delivers near-native performance for the rider's live GPS tracking view and the manager's approval workflows.

**Key packages:**
- `expo-location` — background GPS tracking for rider position updates
- `react-native-maps` — Google Maps integration for delivery zone drawing and rider tracking
- `expo-notifications` — Firebase FCM push notifications via Expo's notification service
- `expo-camera` — proof-of-delivery photo capture
- `@legendapp/state` — fine-grained reactive state (replaces Zustand for mobile, handles GPS coordinate updates at 1Hz without unnecessary re-renders)

### OTA Updates: **Expo EAS Update**

Critical bug fixes and menu updates are pushed over-the-air to all rider devices without going through the Play Store review cycle. Branches that need immediate menu changes propagate to rider devices within minutes.

---

## 4. Frontend — QR Self-Ordering (Customer-Facing)

### Framework: **Astro 5 + React Islands**

The customer QR ordering interface is accessed from any phone browser. It is not installed — it must load fast on 3G connections in Pakistan and MENA.

**Astro 5** ships zero JavaScript by default and hydrates only the interactive cart component as a React Island. The menu browsing experience (the majority of the page) is static HTML delivered from the CDN edge. This achieves sub-1 second Time-to-Interactive on 3G.

---

## 5. Backend API

### Runtime: **Node.js 22 LTS (with Bun for tooling)**

Node.js 22 LTS is the production runtime — battle-tested, well-supported by all hosting providers, and the entire npm ecosystem is available. **Bun** is used for local development (`bun run dev`) and CI (`bun test`) for its significantly faster startup and test execution. Production containers run Node.js.

### Framework: **Fastify v5 + TypeScript 5.5**

Fastify v5 is chosen over Express for three concrete reasons relevant to the PRD:

1. **Schema-first validation:** Fastify validates every request and response against a JSON Schema (generated from shared Zod schemas). This enforces the multi-tenant API contract and gives free OpenAPI spec generation.
2. **Performance:** Fastify handles ~70,000 req/sec on commodity hardware vs Express's ~15,000. At 1M orders/day the difference is material.
3. **Plugin architecture:** tenant middleware, RBAC enforcement, and audit logging are Fastify plugins that register cleanly without global middleware soup.

### API Design: **REST + WebSocket (no GraphQL)**

The PRD calls for REST + WebSocket. GraphQL adds complexity without benefit for this use case — the data shapes are predictable and performance-sensitive endpoints (order punching, KDS sync) need fine-grained caching control that GraphQL makes harder.

WebSocket connections (via `@fastify/websocket`) are used for:
- KDS live order queue updates
- Rider GPS position broadcasts
- Admin dashboard live order feed

### Real-Time Engine: **Socket.IO v4 with Redis Adapter**

Socket.IO's Redis adapter (using `socket.io-redis`) enables horizontal scaling — any backend pod can emit an event and all connected clients across all pods receive it. This is essential for the 10,000-tenant scale requirement.

Rooms are namespaced by `tenant_id` and `branch_id`, ensuring strict event isolation between tenants.

### Background Jobs: **BullMQ v5 (Redis-backed)**

All async work goes through BullMQ queues:
- Offline order sync replay
- WhatsApp receipt delivery (Twilio API calls)
- AI demand forecast model training (triggered nightly)
- Aggregator order polling (Foodpanda, Careem)
- Low-stock alert notifications
- Invoice PDF generation

BullMQ's bull board UI is exposed under `/internal/jobs` for ops monitoring.

### Monorepo Structure: **Turborepo**

```
dineiz/
├── apps/
│   ├── pos/            ← Next.js POS PWA
│   ├── dashboard/      ← Next.js admin dashboard
│   ├── rider/          ← Expo React Native
│   ├── qr-menu/        ← Astro customer ordering
│   └── api/            ← Fastify backend
├── packages/
│   ├── schemas/        ← Shared Zod schemas (frontend + backend)
│   ├── ui/             ← Shared React component library
│   ├── db/             ← Drizzle ORM schema + migrations
│   └── config/         ← Shared ESLint, TypeScript, Tailwind configs
```

Turborepo's remote caching ensures CI builds complete in under 3 minutes even as the codebase grows.

---

## 6. Database Layer

### Primary Database: **PostgreSQL 17 (via Supabase or AWS RDS)**

PostgreSQL 17 is the only rational choice for this PRD given:
- **Row-Level Security (RLS):** PostgreSQL's RLS policies enforce tenant isolation at the database engine level — a misconfigured API cannot leak cross-tenant data. Every table has a policy: `tenant_id = current_setting('app.tenant_id')`.
- **JSONB columns:** Menu item add-on configurations, custom field schemas, and receipt templates are stored as JSONB — flexible without sacrificing queryability.
- **Full-text search:** Menu item search and customer CRM search use PostgreSQL's `tsvector` full-text index (no separate Elasticsearch needed at this scale).
- **Point-in-time recovery:** Required by the PRD's 1-hour RPO SLA.

**Hosting decision:** Use **Supabase** for the managed PostgreSQL offering. Supabase provides connection pooling (via PgBouncer), built-in RLS tooling, and a real-time subscription layer (used for the admin dashboard's live order feed as a supplement to Socket.IO).

### ORM: **Drizzle ORM v2**

Drizzle is chosen over Prisma for this project because:
- It generates raw SQL — no hidden N+1 queries or unexpected full-table scans on the hot path (order punching, KDS queue fetches).
- The schema is TypeScript code, not a DSL, so it lives in the monorepo's `packages/db` and is imported directly by the API and migration runner.
- Drizzle's query builder provides type-safe joins without sacrificing SQL expressiveness for complex analytics queries.

### Cache Layer: **Redis 7.4 (Valkey or AWS ElastiCache)**

Redis serves three distinct roles:

1. **Session cache:** Active shift state, tenant settings, and menu data cached per tenant. TTL-based invalidation on menu updates.
2. **Real-time pub/sub:** Socket.IO Redis adapter for cross-pod event broadcasting.
3. **BullMQ job queues:** All background job metadata stored in Redis.

Use **Valkey** (the open-source Redis fork maintained by AWS, Google, and others) on self-managed deployments to avoid Redis Ltd licensing concerns. AWS ElastiCache (Redis-compatible) for managed cloud deployments.

### Search: **Meilisearch (self-hosted)**

Menu item search and customer CRM search use Meilisearch for typo-tolerant, instant-search results. Meilisearch syncs from PostgreSQL via BullMQ jobs on every menu update. At this scale, a dedicated search engine is justified by the PRD's requirement for fast item lookup on the POS punching screen.

### Time-Series Data: **TimescaleDB extension on PostgreSQL**

Sales analytics and the AI demand forecast use the TimescaleDB extension (a PostgreSQL extension, not a separate service). Hourly order aggregates are stored as hypertables, enabling fast range queries for the heatmap and trend charts without a separate time-series database.

---

## 7. Authentication & Authorization

### Auth Provider: **Better Auth v1 (self-hosted)**

Better Auth (released 2024, production-mature in 2025–2026) is chosen over Auth0/Clerk/Supabase Auth for this project because:
- **Self-hosted:** Auth data stays within the tenant's data boundary. This is a hard requirement for Enterprise white-label clients.
- **Multi-tenant sessions:** Better Auth has first-class support for tenant-scoped sessions — a user can be a manager in Tenant A and a cashier in Tenant B simultaneously.
- **Custom session adapters:** PIN-based quick login for shared POS terminals (cashier PIN) alongside full username/password for admin roles.

### Authorization: **Custom RBAC Middleware (Fastify plugin)**

The PRD defines 8 distinct roles. RBAC is implemented as a Fastify plugin that:
1. Reads the JWT from the `Authorization` header.
2. Validates the token and extracts `tenant_id`, `branch_id`, `role`, and `permissions`.
3. Injects these into the Fastify request context.
4. Each route handler declares its required permission via a decorator — access is denied at the framework layer before business logic runs.

Permissions are stored in PostgreSQL and cached in Redis (invalidated on role change).

### JWT Strategy

- **Access tokens:** 15-minute expiry, signed with RS256 (asymmetric — verification keys can be distributed to edge functions).
- **Refresh tokens:** 30-day expiry, stored in `httpOnly` cookie, rotated on each use (refresh token rotation prevents theft).
- **PIN tokens:** Short-lived (8-hour shift duration), scoped to cashier role only, no refresh token issued.

---

## 8. Notifications

### Push Notifications: **Firebase Cloud Messaging (FCM) via `firebase-admin` SDK**

FCM handles push notifications to the Rider app (new delivery assignments) and Manager app (low stock alerts, rush order flags). Server-side sends go through the `firebase-admin` Node.js SDK from BullMQ worker jobs.

### SMS: **Twilio Verify + Messaging API**

- OTP verification during onboarding: Twilio Verify.
- Order status SMS to customers: Twilio Messaging (with local Pakistani and UAE sender IDs for delivery).

### WhatsApp: **WhatsApp Cloud API (Meta)**

The PRD specifically calls out WhatsApp receipts. The WhatsApp Cloud API (Meta's official offering) handles:
- Order confirmation messages with itemized bill.
- Digital receipt with payment summary.
- Birthday loyalty vouchers via WhatsApp template messages.

Template messages are pre-approved per tenant's WhatsApp Business Account.

### Email: **Resend**

Transactional emails (invoice PDFs, welcome emails, shift reports) sent via Resend. Resend supports custom `from` domains, satisfying the white-label requirement for receipts sent from `orders@restaurantname.com`.

---

## 9. File Storage

### Primary: **AWS S3 + CloudFront CDN**

- Menu item images, receipt PDFs, proof-of-delivery photos stored in S3.
- All objects are private by default; pre-signed URLs (15-minute expiry) are issued by the API for each access.
- CloudFront CDN serves menu images globally with edge caching — critical for the QR ordering interface where customers load the full menu on their phones.
- Bucket naming convention: `dineiz-tenant-{tenant_id}` with strict IAM policies per tenant.

### Invoice PDF Generation: **Puppeteer (headless Chrome) in a dedicated worker**

Invoice PDFs are generated by rendering an HTML template in headless Chrome via Puppeteer. This runs in a separate Docker container (the "PDF worker") queued via BullMQ, ensuring PDF generation never blocks the main API.

---

## 10. AI & ML Features

### Demand Forecasting: **Python Microservice (FastAPI + Prophet + scikit-learn)**

The AI demand forecast feature (PRD Module 7) is implemented as a separate Python microservice rather than inside the Node.js API. This is the correct architectural decision — Python owns the ML ecosystem.

- **Prophet (Meta's time-series library):** Models weekly and daily seasonality in order volumes. Chosen over ARIMA because it handles the irregular Pakistani/MENA holiday calendar (Eid, Ramadan) as custom seasonality components.
- **scikit-learn:** Feature engineering pipeline for item-level predictions (weather, day-of-week, promotions active).
- **FastAPI:** Exposes `/forecast/{tenant_id}/{branch_id}` endpoint called by the Node.js API.
- Forecasts are pre-computed nightly via BullMQ and stored in PostgreSQL. The dashboard fetches cached forecasts — no live ML inference on the hot path.

### AI-Powered Features (LLM): **Anthropic Claude API (claude-sonnet-4-20250514)**

Used for two specific features in Phase 3:
1. **Menu description generation:** Restaurant admin uploads item photos; Claude generates SEO-friendly menu descriptions in English, Urdu, and Arabic.
2. **Anomaly explanation:** When the BI dashboard detects a significant revenue drop, Claude generates a natural language explanation based on the surrounding data (e.g., "Revenue on Tuesday was 34% below forecast. This coincides with a high cancellation rate on delivery orders from Foodpanda, suggesting a potential aggregator sync issue.").

---

## 11. Third-Party Integrations

### API Gateway for Aggregators: **Custom webhook relay service**

A dedicated `aggregator-bridge` microservice (Node.js, Fastify) handles polling and webhook reception from Foodpanda, Careem, HungerStation, and Talabat. Each aggregator's proprietary API format is normalized to the Dineiz internal order schema. This isolation ensures that a breaking change in Foodpanda's API does not affect the core order API.

### Maps: **Google Maps Platform (Maps JS API + Routes API)**

- Delivery zone polygon drawing: Maps JS API with `@googlemaps/js-api-loader`.
- ETA calculation: Routes API (successor to Directions API, GA in 2024).
- Rider live tracking: Maps JS API with custom markers updated via Socket.IO.

### Payment Gateways

| Region | Gateway | Integration Method |
|---|---|---|
| Pakistan | JazzCash, EasyPaisa, SadaPay | REST API, QR code generation |
| UAE/KSA | Stripe, PayFast, HyperPay | Stripe SDK, REST |
| Future | Checkout.com | REST (regional coverage) |

Payment gateway credentials are stored encrypted per-tenant using AWS KMS. Dineiz never stores raw card data (PRD PCI-DSS requirement).

---

## 12. Deployment & Infrastructure

### Containerization: **Docker + Docker Compose (dev) / Kubernetes (prod)**

All services are containerized. Base images use `node:22-alpine` and `python:3.12-slim` for minimal attack surface and fast pull times.

### Orchestration: **AWS EKS (Kubernetes)**

AWS EKS manages the production cluster. Key configurations:
- **Namespace per environment:** `dineiz-prod`, `dineiz-staging`, `dineiz-dev`.
- **HorizontalPodAutoscaler:** API pods scale on CPU (target 60%) and custom metric: Socket.IO connection count.
- **Node groups:** Separate node groups for API workloads (compute-optimized), ML workers (memory-optimized), and PDF workers (burstable).

### CI/CD: **GitHub Actions + ArgoCD**

- **GitHub Actions:** Runs on every PR — Bun test suite, TypeScript type check, Zod schema validation, Docker image build and push to AWS ECR.
- **ArgoCD:** GitOps deployment. ArgoCD watches the `deploy/` manifests in the repo; merging to `main` triggers a rolling deployment to staging automatically. Production deployments require a manual approval step.

### Infrastructure as Code: **AWS CDK (TypeScript)**

All AWS resources (EKS cluster, RDS, ElastiCache, S3 buckets, CloudFront distributions, IAM roles) are defined in AWS CDK TypeScript. This keeps infra changes in the same monorepo, reviewed via PRs, and deployed by the same CI/CD pipeline.

### DNS & SSL: **AWS Route 53 + AWS Certificate Manager**

Custom domain white-labeling (e.g., `pos.restaurantname.com`) is handled via:
1. Tenant admin adds a `CNAME` record pointing to `{tenant_id}.tenants.dineiz.io`.
2. The Dineiz ingress controller (NGINX Ingress) reads the `Host` header to route to the correct tenant namespace.
3. **cert-manager** with Let's Encrypt automatically provisions and renews SSL certificates for each custom domain.

### CDN: **CloudFront (static assets) + Vercel Edge (QR menu)**

- The main POS PWA and admin dashboard static assets are served from CloudFront with aggressive cache headers.
- The QR customer ordering Astro app is deployed to **Vercel** for its edge network in South Asia and MENA — critical for sub-1 second load times on mobile in Pakistan.

### Monitoring & Observability

| Tool | Purpose |
|---|---|
| **Grafana + Prometheus** | Infrastructure metrics: pod CPU/memory, queue depth, DB connection pool |
| **Sentry** | Error tracking for frontend (Next.js, Expo) and backend (Fastify) |
| **Axiom** | Log aggregation and search (replaces ELK stack — cheaper, faster at this scale) |
| **Uptime Kuma** | Public uptime monitoring; status page at `status.dineiz.io` |
| **AWS CloudWatch** | RDS performance insights, EKS control plane logs |

### Backup & Recovery

- **RDS automated backups:** Daily snapshots retained for 30 days. Point-in-time recovery enabled (1-hour RPO per PRD).
- **Cross-region replication:** RDS read replica in a secondary AWS region for disaster recovery.
- **S3 versioning:** All tenant asset buckets have versioning enabled. MFA delete required for bucket deletion.

---

## 13. Security Architecture

| Layer | Control |
|---|---|
| **Transport** | TLS 1.3 everywhere. HSTS headers. Certificate pinning in the Expo app. |
| **API** | JWT RS256 auth on every endpoint. Rate limiting via `@fastify/rate-limit` (per-tenant, per-IP). |
| **Database** | RLS policies on every table. Encrypted at rest (AES-256, AWS KMS). Connection pooling via PgBouncer (prevents connection exhaustion attacks). |
| **Secrets** | AWS Secrets Manager. Secrets injected as environment variables at pod startup. Never in source code or Docker images. |
| **Dependency scanning** | Dependabot on all npm and Python packages. Critical CVEs block merge. |
| **Audit log** | Every write operation appended to `audit_events` table: `tenant_id`, `user_id`, `action`, `before_state` (JSONB), `after_state` (JSONB), `ip_address`, `timestamp`. |
| **PCI-DSS** | Dineiz never stores raw card data. All card transactions flow through PCI-DSS certified gateway SDKs. |

---

## 14. Tech Stack Summary Table

| Layer | Technology | Version | Rationale |
|---|---|---|---|
| POS / Dashboard Frontend | Next.js + React | 15 / 19 | PWA support, concurrent rendering, shared codebase |
| Mobile App | Expo (React Native) | 52 | Cross-platform, OTA updates, New Architecture |
| QR Menu | Astro | 5 | Zero JS by default, edge-deployable, fast on 3G |
| Styling | Tailwind CSS | v4 | Oxide engine, RTL support, design token integration |
| State (web) | Zustand + TanStack Query | latest | Minimal boilerplate, offline persistence |
| State (mobile) | LegendApp State | latest | Fine-grained reactivity for GPS updates |
| Backend Framework | Fastify + TypeScript | v5 / 5.5 | 70k req/sec, schema-first, plugin architecture |
| ORM | Drizzle ORM | v2 | Raw SQL output, type-safe, no hidden queries |
| Primary DB | PostgreSQL | 17 | RLS multi-tenant isolation, JSONB, full-text search |
| DB Hosting | Supabase / AWS RDS | — | Managed Postgres with RLS tooling |
| Cache / Queue | Redis (Valkey) | 7.4 | Session cache, Socket.IO adapter, BullMQ |
| Job Queue | BullMQ | v5 | Reliable async jobs, retry logic, monitoring |
| Real-time | Socket.IO | v4 | KDS sync, rider GPS, live feed |
| Auth | Better Auth | v1 | Self-hosted, multi-tenant, PIN session support |
| Push Notifications | Firebase FCM | Admin SDK v12 | Rider + manager push |
| SMS | Twilio | latest | OTP + order status SMS |
| WhatsApp | Meta Cloud API | v20 | Receipts, confirmations, loyalty messages |
| Email | Resend | latest | Custom domain support for white-label |
| File Storage | AWS S3 + CloudFront | — | Per-tenant buckets, CDN-served menu images |
| Search | Meilisearch | v1.8 | Typo-tolerant menu and CRM search |
| AI / ML | Prophet + scikit-learn | latest | Demand forecasting microservice |
| LLM | Anthropic Claude API | claude-sonnet-4 | Menu copy generation, anomaly explanation |
| Containerization | Docker | 27 | Alpine base images, multi-stage builds |
| Orchestration | AWS EKS (Kubernetes) | 1.30 | Auto-scaling, namespace isolation |
| CI/CD | GitHub Actions + ArgoCD | — | GitOps, auto-deploy to staging, manual prod gate |
| IaC | AWS CDK (TypeScript) | v2 | Infra in monorepo, reviewed via PRs |
| Monitoring | Grafana + Prometheus + Sentry | — | Metrics, errors, alerting |
| Logging | Axiom | — | Log aggregation, cheaper than ELK |
| Maps | Google Maps Platform | — | Delivery zones, rider tracking, ETA |

---

*Dineiz POS — Tech Stack Recommendation v1.0 — April 2026 — Confidential*
