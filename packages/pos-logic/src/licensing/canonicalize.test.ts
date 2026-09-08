import { describe, expect, it } from 'vitest';
import { canonicalizeLicensePayload } from './canonicalize';
import type { LicensePayload } from './types';

const base: LicensePayload = {
  licenseId: 'lic-1',
  restaurantName: 'Test Cafe',
  machineFingerprint: 'fp-1',
  issuedAt: '2026-01-01T00:00:00.000Z',
  expiresAt: null,
};

describe('canonicalizeLicensePayload', () => {
  it('produces identical output regardless of the input object\'s own key order', () => {
    const reordered: LicensePayload = {
      expiresAt: base.expiresAt,
      issuedAt: base.issuedAt,
      machineFingerprint: base.machineFingerprint,
      restaurantName: base.restaurantName,
      licenseId: base.licenseId,
    };
    expect(canonicalizeLicensePayload(base)).toBe(canonicalizeLicensePayload(reordered));
  });

  it('produces different output when any field differs', () => {
    const changed = { ...base, restaurantName: 'Different Cafe' };
    expect(canonicalizeLicensePayload(base)).not.toBe(canonicalizeLicensePayload(changed));
  });

  it('is deterministic across repeated calls', () => {
    expect(canonicalizeLicensePayload(base)).toBe(canonicalizeLicensePayload(base));
  });
});
