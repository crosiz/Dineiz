import { migration001Init } from './001_init'
import { migration002OrderSettings } from './002_order_settings'
import { migration003Printing } from './003_printing'
import { migration004Backups } from './004_backups'
import { migration005RushHourMode } from './005_rush_hour_mode'
import { migration006OwnerRecoveryCode } from './006_owner_recovery_code'

export interface Migration {
  name: string
  sql: string
}

export const migrations: Migration[] = [
  { name: '001_init', sql: migration001Init },
  { name: '002_order_settings', sql: migration002OrderSettings },
  { name: '003_printing', sql: migration003Printing },
  { name: '004_backups', sql: migration004Backups },
  { name: '005_rush_hour_mode', sql: migration005RushHourMode },
  { name: '006_owner_recovery_code', sql: migration006OwnerRecoveryCode }
]
