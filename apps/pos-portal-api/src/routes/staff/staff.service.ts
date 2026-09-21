import bcrypt from 'bcrypt';
import { prisma } from '@dineiz/pos-portal-db';

export async function listStaff(branchId: string) {
  return prisma.user.findMany({ where: { branchId }, orderBy: { name: 'asc' } });
}

function generatePin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export async function createStaffMember(
  tenantId: string,
  branchId: string,
  input: { name: string; role: 'BRANCH_MANAGER' | 'CASHIER' | 'WAITER' | 'KITCHEN_STAFF' }
) {
  const pin = generatePin();
  const posPinHash = await bcrypt.hash(pin, 10);
  const user = await prisma.user.create({
    data: { tenantId, branchId, name: input.name, role: input.role, posPinHash },
  });
  // Returned once, at creation time only — posPinHash never leaves the server.
  return { id: user.id, name: user.name, role: user.role, pin };
}

export async function deleteStaffMember(branchId: string, userId: string): Promise<boolean> {
  const { count } = await prisma.user.deleteMany({ where: { id: userId, branchId } });
  return count > 0;
}

export async function listPermissions(tenantId: string, role: string) {
  return prisma.rolePermission.findMany({ where: { tenantId, role: role as any } });
}

export async function listAttendance(branchId: string) {
  return prisma.attendanceEntry.findMany({
    where: { user: { branchId } },
    include: { user: true },
    orderBy: { checkIn: 'desc' },
    take: 50,
  });
}

export async function listPayroll(branchId: string) {
  return prisma.payrollEntry.findMany({
    where: { user: { branchId } },
    include: { user: true },
    orderBy: { month: 'desc' },
  });
}
