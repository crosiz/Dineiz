import type Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import { newId } from '../lib/ids'

export interface SetupInput {
  restaurantName: string
  address?: string
  ntn?: string
  cashTaxRatePercent: number
  cardTaxRatePercent: number
  ownerName: string
  ownerEmail?: string
  ownerPassword: string
}

export interface SetupResult {
  restaurantId: string
  ownerId: string
  /** The one and only time this is ever shown in plaintext — see generateRecoveryCode's doc comment. */
  ownerRecoveryCode: string
}

// Excludes 0/O/1/I/L — characters easy to mistranscribe by hand — and is
// deliberately not base64: this is meant to be written down and read back
// by a person, not copy-pasted. 20 chars from a 32-symbol alphabet is ~100
// bits of entropy, comfortably enough for a credential that's only ever
// checked locally (no online brute-force surface at all).
const RECOVERY_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function generateRecoveryCode(): string {
  const bytes = randomBytes(20)
  const chars = Array.from(bytes, (b) => RECOVERY_CODE_ALPHABET[b % RECOVERY_CODE_ALPHABET.length])
  const groups = [chars.slice(0, 5), chars.slice(5, 10), chars.slice(10, 15), chars.slice(15, 20)]
  return groups.map((g) => g.join('')).join('-')
}

export function isSetupComplete(db: Database.Database): boolean {
  const restaurant = db.prepare('SELECT id FROM restaurant LIMIT 1').get()
  const owner = db.prepare("SELECT id FROM users WHERE role = 'OWNER' LIMIT 1").get()
  return Boolean(restaurant && owner)
}

export function completeSetup(db: Database.Database, input: SetupInput): SetupResult {
  if (isSetupComplete(db)) {
    throw new Error('Setup has already been completed')
  }
  if (!input.restaurantName.trim()) {
    throw new Error('Restaurant name is required')
  }
  if (!input.ownerName.trim()) {
    throw new Error('Owner name is required')
  }
  if (input.ownerPassword.length < 6) {
    throw new Error('Password must be at least 6 characters')
  }

  const restaurantId = newId()
  const ownerId = newId()
  const passwordHash = bcrypt.hashSync(input.ownerPassword, 10)

  // This install has no internet-based account recovery by design (it's
  // offline-first) — without this, a forgotten owner password is a
  // permanent lockout with no way back in short of directly editing the
  // SQLite file. One recovery code, generated once, shown once, resets any
  // OWNER's password later (see auth.service.ts's resetPasswordWithRecoveryCode).
  // Restaurant-level rather than per-owner: simpler to reason about for the
  // common single-owner case, and if there are several owners, any of them
  // holding the code being able to help a locked-out co-owner back in is
  // the correct behavior, not a bug.
  const ownerRecoveryCode = generateRecoveryCode()
  const recoveryCodeHash = bcrypt.hashSync(ownerRecoveryCode, 10)

  const run = db.transaction(() => {
    db.prepare(
      `INSERT INTO restaurant (id, name, address, ntn, cash_tax_rate, card_tax_rate, owner_recovery_code_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      restaurantId,
      input.restaurantName.trim(),
      input.address ?? null,
      input.ntn ?? null,
      input.cashTaxRatePercent,
      input.cardTaxRatePercent,
      recoveryCodeHash,
    )

    db.prepare(
      `INSERT INTO users (id, name, email, password_hash, role, is_active)
       VALUES (?, ?, ?, ?, 'OWNER', 1)`,
    ).run(ownerId, input.ownerName.trim(), input.ownerEmail ?? null, passwordHash)

    // A fresh install with zero floors would force the very first admin
    // session to go create a floor before they can add a single table —
    // one default floor (renameable, deletable once a real one exists)
    // means Tables is immediately usable instead of an empty dead end.
    db.prepare('INSERT INTO floors (id, name, sort_order) VALUES (?, ?, 0)').run(newId(), 'Main Floor')
  })
  run()

  return { restaurantId, ownerId, ownerRecoveryCode }
}
