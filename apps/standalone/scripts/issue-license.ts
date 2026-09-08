/**
 * Offline license-issuing tool for whoever holds the private key (the
 * business, not this app). Never imported by the app itself — the app only
 * ever has the public key (see src/main/licensing/publicKey.ts).
 *
 * Build + run (from apps/standalone):
 *   pnpm harness:build
 *   ELECTRON_RUN_AS_NODE=1 ./node_modules/electron/dist/electron.exe .harness-build/scripts/issue-license.js \
 *     --private-key <path-to-private-key.pem> --restaurant "Restaurant Name" --fingerprint <machine-fingerprint> \
 *     [--days 365] [--out license.json]
 *
 * The machine fingerprint comes from the activation screen on the
 * customer's installed copy of the app — ask them to read it off-screen
 * (or send a screenshot) before issuing their license.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import type { LicensePayload } from '@dineiz/pos-logic'
import { signLicensePayload } from '../src/main/licensing/sign'

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function main(): void {
  const privateKeyPath = arg('private-key')
  const restaurantName = arg('restaurant')
  const fingerprint = arg('fingerprint')
  const days = arg('days')
  const out = arg('out') ?? 'license.json'

  if (!privateKeyPath || !restaurantName || !fingerprint) {
    console.error(
      'Usage: issue-license --private-key <path> --restaurant "<name>" --fingerprint <fp> [--days 365] [--out license.json]'
    )
    process.exitCode = 1
    return
  }

  const privateKeyPem = readFileSync(privateKeyPath, 'utf-8')
  const payload: LicensePayload = {
    licenseId: randomUUID(),
    restaurantName,
    machineFingerprint: fingerprint,
    issuedAt: new Date().toISOString(),
    expiresAt: days ? new Date(Date.now() + Number(days) * 24 * 60 * 60 * 1000).toISOString() : null
  }

  const signed = signLicensePayload(payload, privateKeyPem)
  writeFileSync(out, JSON.stringify(signed, null, 2))

  console.log(`License written to ${out}`)
  console.log(JSON.stringify(payload, null, 2))
}

main()
