import { createVerify } from 'node:crypto'
import { canonicalizeLicensePayload, type SignedLicense } from '@dineiz/pos-logic'
import { LICENSE_PUBLIC_KEY_PEM } from './publicKey'

export type LicenseRejectionReason = 'INVALID_SIGNATURE' | 'EXPIRED' | 'FINGERPRINT_MISMATCH'

export type LicenseVerificationResult = { valid: true } | { valid: false; reason: LicenseRejectionReason }

/**
 * Re-verifies the signature every time it's called — never trusts a cached
 * "this license was valid before" boolean, since the SQLite file storing
 * the activated license is directly editable by anyone with a text/hex
 * editor. Order matters: the signature is checked first and short-circuits
 * on failure, because an unsigned/forged payload's expiresAt or
 * machineFingerprint fields mean nothing at all — they could say anything.
 */
export function verifyLicense(
  signed: SignedLicense,
  currentFingerprint: string,
  publicKeyPem: string = LICENSE_PUBLIC_KEY_PEM
): LicenseVerificationResult {
  const verifier = createVerify('RSA-SHA256')
  verifier.update(canonicalizeLicensePayload(signed.payload))
  verifier.end()

  const signatureValid = verifier.verify(publicKeyPem, signed.signature, 'base64')
  if (!signatureValid) return { valid: false, reason: 'INVALID_SIGNATURE' }

  if (signed.payload.expiresAt && new Date(signed.payload.expiresAt).getTime() < Date.now()) {
    return { valid: false, reason: 'EXPIRED' }
  }

  if (signed.payload.machineFingerprint !== currentFingerprint) {
    return { valid: false, reason: 'FINGERPRINT_MISMATCH' }
  }

  return { valid: true }
}
