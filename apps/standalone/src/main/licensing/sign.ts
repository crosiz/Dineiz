import { createSign } from 'node:crypto'
import { canonicalizeLicensePayload, type LicensePayload, type SignedLicense } from '@dineiz/pos-logic'

/** Only ever called by scripts/issue-license.ts (offline, by whoever holds the private key) — never by the app itself. */
export function signLicensePayload(payload: LicensePayload, privateKeyPem: string): SignedLicense {
  const signer = createSign('RSA-SHA256')
  signer.update(canonicalizeLicensePayload(payload))
  signer.end()
  const signature = signer.sign(privateKeyPem, 'base64')
  return { payload, signature }
}
