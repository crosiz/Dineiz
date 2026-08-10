param([string]$Command)
switch ($Command) {
  "infra"   { docker compose up db redis meilisearch -d }
  "dev"     { docker compose up api dashboard pos }
  "migrate" { docker compose --profile migrate run --rm prisma-migrate }
  "seed"    { docker compose exec api sh -c "cd /app/packages/db && pnpm seed" }
  "logs"    { docker compose logs -f api dashboard pos }
  "stop"    { docker compose down }
  "clean"   { docker compose down -v }
  "clean-nm" {
    docker compose down
    docker volume rm swiftserve_api_nm swiftserve_dashboard_nm swiftserve_pos_nm swiftserve_prisma_nm swiftserve_pnpm_store
  }
  default   { Write-Host "Commands: infra, dev, migrate, seed, logs, stop, clean, clean-nm" }
}
