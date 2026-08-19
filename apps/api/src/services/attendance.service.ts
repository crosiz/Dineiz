import { prisma } from '@dineiz/db'
import { addMinutes, differenceInMinutes } from 'date-fns'
import type { AttendancePunchData } from './zkteco.service'

// We need a mock io instance or real one. For now, let's assume we have access to socket plugin
import { getIO } from '../lib/socket'; 
// Note: We might need to adjust socket emission depending on how `io` is exposed in this codebase.

export async function processPunch(punch: AttendancePunchData, method: 'ZKTECO' | 'MANUAL' = 'ZKTECO') {
  let staff: any;

  if (method === 'ZKTECO') {
    // Find which staff member this ZKTeco userId belongs to
    const enrollment = await prisma.staffZktecoEnrollment.findUnique({
      where: { deviceId_zkUserId: { deviceId: punch.deviceId, zkUserId: parseInt(punch.userId, 10) } },
      include: { user: true }
    })

    if (!enrollment) {
      console.warn(`ZKTeco punch received for unregistered user ID ${punch.userId}`)
      return
    }
    staff = enrollment.user
  } else {
    // For MANUAL, userId is already the system user ID
    staff = await prisma.user.findUnique({ where: { id: punch.userId } })
    if (!staff) return
  }

  // Save the punch record
  await prisma.attendancePunch.create({
    data: {
      tenantId: punch.tenantId,
      branchId: punch.branchId,
      userId: staff.id,
      deviceId: punch.deviceId,
      zkUserId: method === 'ZKTECO' ? parseInt(punch.userId, 10) : 0,
      punchTime: punch.punchTime,
      punchType: punch.punchType,
      method
    }
  })

  if (punch.punchType === 'CLOCK_IN') {
    // Check if staff already has an open shift — avoid duplicates
    const existingShift = await prisma.shift.findFirst({
      where: { userId: staff.id, closedAt: null }
    })
    if (existingShift) return

    // Dummy schedule fetching to follow user prompt
    // Ideally: const schedule = await getScheduledShift(staff.id, punch.branchId, punch.punchTime)
    const schedule: any = null // Placeholder

    const isLate = schedule ? punch.punchTime > addMinutes(schedule.startTime, 5) : false
    const lateMinutes = isLate ? differenceInMinutes(punch.punchTime, schedule.startTime) : 0

    // Open shift automatically
    const shift = await prisma.shift.create({
      data: {
        tenantId: punch.tenantId,
        branchId: punch.branchId,
        userId: staff.id,
        openedAt: punch.punchTime,
        openingFloat: 0,
        method
      }
    })

    // Update attendance punch with shift ID and late status
    await prisma.attendancePunch.updateMany({
      where: { userId: staff.id, punchTime: punch.punchTime },
      data: { shiftId: shift.id, isLate, lateMinutes }
    })

    // Notify dashboard via Socket.IO. Scoped like emitDashboardStatsUpdated —
    // the Shift Management dashboard connects to /kds and joins branch/tenant
    // rooms there, not on the default namespace, which is where this
    // previously landed with nobody listening.
    if (getIO()) {
      const io = getIO()!.of('/kds');
      const payload = {
        shiftId: shift.id,
        staffName: staff.name,
        branchId: punch.branchId,
        openedAt: punch.punchTime,
        method
      };
      io.to(`branch:${punch.branchId}`).emit('shift:opened', payload);
      io.to(`tenant:${punch.tenantId}`).emit('shift:opened', payload);
    }

  } else if (punch.punchType === 'CLOCK_OUT') {
    // Find the open shift for this staff member
    const openShift = await prisma.shift.findFirst({
      where: { userId: staff.id, closedAt: null }
    })
    if (!openShift) return

    // Close the shift
    await prisma.shift.update({
      where: { id: openShift.id },
      data: {
        closedAt: punch.punchTime,
        method
      }
    })

    // Notify dashboard — same /kds scoping as the clock-in path above.
    if (getIO()) {
      const io = getIO()!.of('/kds');
      const payload = {
        shiftId: openShift.id,
        staffName: staff.name,
        branchId: punch.branchId,
        closedAt: punch.punchTime
      };
      io.to(`branch:${punch.branchId}`).emit('shift:closed', payload);
      io.to(`tenant:${punch.tenantId}`).emit('shift:closed', payload);
    }
  }
}
