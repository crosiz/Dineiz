dev:
	docker compose up db redis meilisearch -d
	docker compose up api dashboard pos

infra:
	docker compose up db redis meilisearch -d

migrate:
	docker compose --profile migrate run --rm prisma-migrate

studio:
	cd packages/db && pnpm prisma studio

seed:
	cd packages/db && pnpm seed

logs:
	docker compose logs -f api dashboard pos

stop:
	docker compose down

clean:
	docker compose down -v
	rd /s /q node_modules 2>nul || true
	rd /s /q .pnpm-store 2>nul || true

clean-nm:
	docker compose down
	docker volume rm dineiz_api_nm dineiz_dashboard_nm dineiz_pos_nm dineiz_prisma_nm dineiz_pnpm_store 2>nul || true
	docker compose up db redis meilisearch -d

# Run this on Windows host whenever package.json files change
sync:
	pnpm install --no-frozen-lockfile
