import type { LicensePayload } from './types';

/**
 * Fixed field order so signing and verifying always hash identical bytes —
 * `JSON.stringify` on a spread/rest-constructed object is not guaranteed
 * stable across engines/field-addition order, so the object is built with
 * an explicit key order here rather than passed through as-is.
 */
export function canonicalizeLicensePayload(payload: LicensePayload): string {
  const ordered: LicensePayload = {
    licenseId: payload.licenseId,
    restaurantName: payload.restaurantName,
    machineFingerprint: payload.machineFingerprint,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
  };
  return JSON.stringify(ordered);
}
