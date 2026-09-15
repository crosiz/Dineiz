/**
 * The RSA public key every installation verifies license files against.
 * The matching private key is deliberately NOT in this repository — it
 * lives offline, held by whoever is authorized to issue licenses (see
 * scripts/issue-license.ts). Compiling only the public half in here means
 * a compromised or leaked build of this app can never be used to forge a
 * license — verification requires the public key, but signing requires the
 * private one, which was never present.
 */
export const LICENSE_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0kUC1vRyINJIPpTdOGnL
yPCn/IyQNz1NeWfSTqMiooUaezo9ATBNuKgIS805uIef9V62lVVa5Cepc6yDrLcC
XQPxPKmsw2DgtwtfthUwEV/7vX8wtmzA9mSclFF2QkNRcNW9SW/D9jOob7duBFK+
nmv6EbASEi5VaAyzDqbgOJTU8Cj8xamkWik3fUbl0Y+4a/nXZR8J7iqp2r0V4Tuj
7MWzIuY/BHEivQQIJOeLIlkpTWJWKTZfJADfTRCFL+KknLc+TXVDthTFvIuE67Tw
bwO3+GxoAP+4Gy5sbHTXHIT2/+N++h2rT/fxiC0YPBw6E7A1PLX1GbfhRLtYFi7u
cwIDAQAB
-----END PUBLIC KEY-----
`
