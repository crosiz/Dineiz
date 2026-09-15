export interface LicensePayload {
  licenseId: string;
  restaurantName: string;
  machineFingerprint: string;
  issuedAt: string;
  /** null = perpetual license, never expires. */
  expiresAt: string | null;
}

export interface SignedLicense {
  payload: LicensePayload;
  /** Base64-encoded RSA-SHA256 signature over `canonicalizeLicensePayload(payload)`. */
  signature: string;
}
