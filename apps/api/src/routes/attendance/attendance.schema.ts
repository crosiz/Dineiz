import { z } from 'zod';

export const manualPunchSchema = z.object({
  userId: z.string().min(1),
  punchType: z.enum(['CLOCK_IN', 'CLOCK_OUT']),
  branchId: z.string().min(1)
});

export const getAttendanceSchema = z.object({
  branchId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  staffId: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional()
});
