export const migration006OwnerRecoveryCode = `
ALTER TABLE restaurant ADD COLUMN owner_recovery_code_hash TEXT;
`
