# Dineiz Platform

Welcome to the **Dineiz** monorepo! This repository houses the entire suite of applications and packages that power the Dineiz restaurant management ecosystem, including our Point of Sale (POS), Dashboard, Web Marketing, and Mobile Apps.

---

## Architecture & Tech Stack

This project is structured as a [Turborepo](https://turbo.build/repo), allowing for lightning-fast incremental builds and shared packages across multiple applications.

### Core Technologies
- **Backend/API:** Node.js, Fastify, Zod (Validation), Socket.io (Real-time)
- **Frontend/Web:** React, Next.js 15, TailwindCSS, Framer Motion
- **Mobile/Apps:** React Native, Expo
- **Database (ORM):** Prisma, PostgreSQL (hosted on [Neon](https://neon.tech))
- **Caching & Queues:** Redis (via [Upstash](https://upstash.com)), BullMQ
- **Media & Storage:** [Cloudinary](https://cloudinary.com)
- **Emails/Messaging:** [Resend](https://resend.com), Twilio
- **Search:** Meilisearch

---

## Project Structure

### Apps (`/apps`)
- **`api/`**: The core Fastify backend service powering the entire platform.
- **`dashboard/`**: The web-based management dashboard for restaurant owners and managers.
- **`pos/`**: The web-based Point of Sale application used by cashiers and waiters.
- **`website/`**: The marketing and landing page website.
- **`super-admin/`**: The internal administration panel for managing tenants and billing.
- **`rider/`**: React Native mobile app for delivery riders.
- **`mobile/`**: React Native mobile app for restaurant customers.
- **`forecast/`** & **`pdf-worker/`**: Auxiliary microservices for analytics and reporting.

### Packages (`/packages`)
- **`db/`**: Centralized Prisma schema and database client.
- **`ui/`**: Shared React components (shadcn/ui), tailwind config, and design tokens.
- **`config/`**: Shared configurations for TypeScript, ESLint, etc.
- **`schemas/`**: Shared Zod validation schemas across frontend and backend.

---

## Getting Started

> [!WARNING]
> **Windows Developers:** Never run `pnpm dev`, `pnpm install`, or any pnpm command directly on your Windows host if you intend to use Docker volumes. Running pnpm on Windows can corrupt the Docker `node_modules` mappings due to symlink/pathing issues. Always use Docker via `make dev`.

### Option A — Full Docker Environment (Recommended)

This requires **Docker Desktop** to be running. No other local setup is needed.

1. Start the infrastructure services:
   ```bash
   docker compose up db redis meilisearch -d
   ```
2. Start the core applications:
   ```bash
   docker compose up api dashboard pos
   ```
3. Access the applications:
   - **Dashboard:** [http://localhost:3000](http://localhost:3000)
   - **POS:** [http://localhost:3001](http://localhost:3001)

### Option B — Windows Native with PNPM (Faster Hot Reloading)

This requires **Docker Desktop** to be running purely for databases, while apps run natively on your machine via `pnpm`.

1. Start the infrastructure in the background:
   ```bash
   docker compose up db redis meilisearch -d
   ```
2. Install dependencies (First time only):
   ```bash
   pnpm install --no-frozen-lockfile
   ```
3. Start the Turborepo development server:
   ```bash
   pnpm dev
   ```
4. Access the applications:
   - **Dashboard:** [http://localhost:3000](http://localhost:3000)
   - **POS:** [http://localhost:3001](http://localhost:3001)
   
*Note: The API must be successfully running for logins to function. You can verify the API is up by checking [http://localhost:8080/health](http://localhost:8080/health).*
