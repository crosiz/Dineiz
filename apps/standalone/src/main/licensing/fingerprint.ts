import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

function readWindowsMachineGuid(): string | null {
  try {
    const output = execFileSync('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'], {
      encoding: 'utf-8',
      windowsHide: true
    })
    const match = /MachineGuid\s+REG_SZ\s+([0-9a-fA-F-]+)/i.exec(output)
    return match ? match[1].trim() : null
  } catch {
    return null
  }
}

/**
 * Prefers Windows' own per-installation MachineGuid — no native module
 * needed, it's read via the OS's built-in reg.exe. Stable across app
 * reinstalls, and tied to the OS install itself rather than to any file
 * this app manages, so copying just this app's data folder to another
 * machine doesn't carry someone else's identity with it.
 *
 * Falls back to a UUID persisted in its own plain file — deliberately NOT
 * inside the SQLite database. A restored/copied db file would otherwise
 * carry a stale fingerprint from whatever machine it came from, which
 * would defeat the entire point of tying a license to one machine.
 */
export function getMachineFingerprint(fallbackFilePath: string): string {
  const fromRegistry = readWindowsMachineGuid()
  if (fromRegistry) return fromRegistry

  if (existsSync(fallbackFilePath)) {
    return readFileSync(fallbackFilePath, 'utf-8').trim()
  }

  const generated = randomUUID()
  mkdirSync(dirname(fallbackFilePath), { recursive: true })
  writeFileSync(fallbackFilePath, generated, 'utf-8')
  return generated
}
