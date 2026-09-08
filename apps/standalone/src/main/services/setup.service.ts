import type Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
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

  const run = db.transaction(() => {
    db.prepare(
      `INSERT INTO restaurant (id, name, address, ntn, cash_tax_rate, card_tax_rate)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      restaurantId,
      input.restaurantName.trim(),
      input.address ?? null,
      input.ntn ?? null,
      input.cashTaxRatePercent,
      input.cardTaxRatePercent,
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

  return { restaurantId, ownerId }
}
