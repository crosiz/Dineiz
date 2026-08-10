import ZKLib from 'zklib'
import { prisma } from '@dineiz/db'

export interface AttendancePunchData {
  userId: string
  punchTime: Date
  punchType: 'CLOCK_IN' | 'CLOCK_OUT' | 'BREAK_START' | 'BREAK_END'
  deviceId: string
  tenantId: string
  branchId: string
}

export interface ZKTecoConfig {
  ip: string
  port: number       // default 4370
  timeout: number    // default 5000ms
  tenantId: string
  branchId: string
  deviceId: string   // stored in DB
}

class ZKTecoService {
  private connections: Map<string, { zk: any; config: ZKTecoConfig }> = new Map()
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map()

  // Connect to a ZKTeco device
  async connect(config: ZKTecoConfig): Promise<boolean> {
    try {
      const zk = new ZKLib({
        ip: config.ip,
        port: config.port,
        timeout: config.timeout,
        inport: 5200 + Math.floor(Math.random() * 1000)
      })
      await new Promise<void>((resolve, reject) => {
        zk.createSocket((err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });
      this.connections.set(config.deviceId, { zk, config })
      return true
    } catch (error) {
      console.error(`ZKTeco connection failed for ${config.ip}:`, error)
      return false
    }
  }

  // Poll device for new attendance records every 30 seconds
  startPolling(deviceId: string, onPunch: (punch: AttendancePunchData) => void) {
    const interval = setInterval(async () => {
      await this.fetchNewPunches(deviceId, onPunch)
    }, 30000)
    this.pollingIntervals.set(deviceId, interval)
  }

  // Fetch attendance logs from device
  async fetchNewPunches(deviceId: string, onPunch: (punch: AttendancePunchData) => void) {
    const connection = this.connections.get(deviceId)
    if (!connection) return

    try {
      const { zk, config } = connection
      const logs = await zk.getAttendances()

      // Get last synced timestamp from DB to avoid reprocessing
      const lastSync = await prisma.zktecoDevice.findUnique({
        where: { id: deviceId },
        select: { lastSyncAt: true }
      })

      const newLogs = logs.data.filter((log: any) =>
        new Date(log.attTime) > (lastSync?.lastSyncAt ?? new Date(0))
      )

      for (const log of newLogs) {
        await onPunch({
          userId: log.deviceUserId.toString(),  // maps to staff enrolled fingerprint ID
          punchTime: new Date(log.attTime),
          punchType: log.verifyType === 0 ? 'CLOCK_IN' : 'CLOCK_OUT',
          deviceId,
          tenantId: config.tenantId,
          branchId: config.branchId
        })
      }

      // Update last sync time
      await prisma.zktecoDevice.update({
        where: { id: deviceId },
        data: { lastSyncAt: new Date(), status: 'ONLINE' }
      })
    } catch (error) {
      await prisma.zktecoDevice.update({
        where: { id: deviceId },
        data: { status: 'OFFLINE' }
      })
    }
  }

  // Get device status
  async getStatus(deviceId: string): Promise<'ONLINE' | 'OFFLINE'> {
    const connection = this.connections.get(deviceId)
    if (!connection) return 'OFFLINE'
    try {
      await connection.zk.getInfo()
      return 'ONLINE'
    } catch {
      return 'OFFLINE'
    }
  }

  // Get all users enrolled on the device
  async getEnrolledUsers(deviceId: string) {
    const connection = this.connections.get(deviceId)
    if (!connection) return []
    const users = await connection.zk.getUsers()
    return users.data
  }

  // Enroll a new user fingerprint on the device
  async enrollUser(deviceId: string, userId: number, name: string) {
    const connection = this.connections.get(deviceId)
    if (!connection) throw new Error('Device not connected')
    await connection.zk.setUser(userId, userId.toString(), name, '', 0, 0)
  }

  disconnect(deviceId: string) {
    const interval = this.pollingIntervals.get(deviceId)
    if (interval) clearInterval(interval)
    const connection = this.connections.get(deviceId)
    if (connection) connection.zk.disconnect()
    this.connections.delete(deviceId)
    this.pollingIntervals.delete(deviceId)
  }
}

export const zktecoService = new ZKTecoService()
