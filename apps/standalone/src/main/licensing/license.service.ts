import type Database from 'better-sqlite3'
import type { LicensePayload, SignedLicense } from '@dineiz/pos-logic'
import { getMachineFingerprint } from './fingerprint'
import { verifyLicense, type LicenseRejectionReason } from './verify'

const ACTIVE_LICENSE_META_KEY = 'active_license'

export interface LicenseStatus {
  activated: boolean
  license: LicensePayload | null
  reason: LicenseRejectionReason | 'NOT_ACTIVATED' | 'CORRUPT_LICENSE_DATA' | null
  machineFingerprint: string
}

function getMeta(db: Database.Database, key: string): string | null {
  const row = db.prepare('SELECT value FROM app_meta WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value ?? null
}

function setMeta(db: Database.Database, key: string, value: string): void {
  db.prepare('INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(
    key,
    value
  )
}

/** Re-checks everything fresh every call — see verify.ts's doc comment on why nothing here is ever cached as a trusted boolean. */
export function getLicenseStatus(db: Database.Database, fingerprintFilePath: string): LicenseStatus {
  const machineFingerprint = getMachineFingerprint(fingerprintFilePath)
  const stored = getMeta(db, ACTIVE_LICENSE_META_KEY)
  if (!stored) return { activated: false, license: null, reason: 'NOT_ACTIVATED', machineFingerprint }

  let signed: SignedLicense
  try {
    signed = JSON.parse(stored) as SignedLicense
  } catch {
    return { activated: false, license: null, reason: 'CORRUPT_LICENSE_DATA', machineFingerprint }
  }

  const result = verifyLicense(signed, machineFingerprint)
  if (!result.valid) return { activated: false, license: signed.payload, reason: result.reason, machineFingerprint }

  return { activated: true, license: signed.payload, reason: null, machineFingerprint }
}

function rejectionMessage(reason: LicenseRejectionReason): string {
  switch (reason) {
    case 'INVALID_SIGNATURE':
      return 'This license file is not valid or has been tampered with.'
    case 'EXPIRED':
      return 'This license has expired.'
    case 'FINGERPRINT_MISMATCH':
      return 'This license was issued for a different computer.'
  }
}

/** Parses, verifies, and (only if valid) stores a license file's contents as the active license. Throws with a user-facing message on rejection. */
export function activateLicense(db: Database.Database, fingerprintFilePath: string, signedLicenseJson: string): LicenseStatus {
  const machineFingerprint = getMachineFingerprint(fingerprintFilePath)

  let signed: SignedLicense
  try {
    signed = JSON.parse(signedLicenseJson) as SignedLicense
  } catch {
    throw new Error('That file is not a valid Dineiz license file.')
  }

  const result = verifyLicense(signed, machineFingerprint)
  if (!result.valid) throw new Error(rejectionMessage(result.reason))

  setMeta(db, ACTIVE_LICENSE_META_KEY, JSON.stringify(signed))
  return { activated: true, license: signed.payload, reason: null, machineFingerprint }
}
