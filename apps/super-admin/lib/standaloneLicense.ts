import { createSign } from 'node:crypto';
import { canonicalizeLicensePayload, type LicensePayload, type SignedLicense } from '@dineiz/pos-logic';

/**
 * Server-side only (Next.js API routes) — signs Dineiz Standalone license
 * files. The private key lives ONLY as an environment variable on this
 * deployment (STANDALONE_LICENSE_PRIVATE_KEY), never in the repository —
 * the matching public key is compiled into apps/standalone's own source
 * (src/main/licensing/publicKey.ts) so the offline app can verify a
 * license without ever needing network access or this key.
 *
 * canonicalizeLicensePayload is imported from @dineiz/pos-logic (the same
 * package apps/standalone uses to verify) specifically so signing and
 * verifying can never drift onto two different canonicalization
 * implementations — that would make every future-issued license
 * unverifiable without anyone noticing until a customer's activation fails.
 */

export function isLicenseSigningConfigured(): boolean {
  return Boolean(process.env.STANDALONE_LICENSE_PRIVATE_KEY);
}

function normalizePem(pem: string): string {
  // Most env-var systems (Vercel included) store a multi-line PEM as a single
  // line with literal "\n" sequences rather than real newlines.
  return pem.includes('\\n') ? pem.replace(/\\n/g, '\n') : pem;
}

export function signStandaloneLicense(payload: LicensePayload): SignedLicense {
  const privateKeyPem = process.env.STANDALONE_LICENSE_PRIVATE_KEY;
  if (!privateKeyPem) {
    throw new Error('STANDALONE_LICENSE_PRIVATE_KEY is not configured on this deployment');
  }

  const signer = createSign('RSA-SHA256');
  signer.update(canonicalizeLicensePayload(payload));
  signer.end();
  const signature = signer.sign(normalizePem(privateKeyPem), 'base64');

  return { payload, signature };
}
