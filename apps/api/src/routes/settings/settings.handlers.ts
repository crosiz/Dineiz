import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@dineiz/db';
import {
  getTenantBranding,
  updateTenantBranding,
  uploadBrandingImage,
  uploadUserAvatar,
  getTenantSettings,
  updateTenantSettings,
  getUserSettings,
  updateNotificationPreferences,
  toggle2FA,
  changePassword,
  getActiveSessions,
  revokeSession,
  revokeAllOtherSessions,
  queueExportDataJob
} from './settings.service';

export async function handleUploadUserAvatar(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user!.id;

  const data = await request.file();
  if (!data) {
    return reply.status(400).send({ error: 'No file uploaded' });
  }

  const buffer = await data.toBuffer();
  const result = await uploadUserAvatar(userId, buffer, data.mimetype);
  return reply.send(result);
}

export async function handleUpdateUserProfile(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user!.id;
  const { name } = request.body as { name?: string };

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { ...(name && { name }) },
    select: { id: true, name: true, image: true },
  });
  return reply.send(updated);
}

export async function handleGetBranding(request: FastifyRequest, reply: FastifyReply) {
  const tenantId = (request.user!.tenantId as string);
  const branding = await getTenantBranding(tenantId);
  return reply.send(branding);
}

export async function handleUpdateBranding(request: FastifyRequest, reply: FastifyReply) {
  const tenantId = (request.user!.tenantId as string);
  const updated = await updateTenantBranding(tenantId, request.body);
  return reply.send(updated);
}

export async function handleUploadBrandingImage(request: FastifyRequest, reply: FastifyReply) {
  const tenantId = (request.user!.tenantId as string);
  
  const data = await request.file();
  if (!data) {
    return reply.status(400).send({ error: 'No file uploaded' });
  }

  const type = (request.query as any).type || 'logo';
  const buffer = await data.toBuffer();
  
  const result = await uploadBrandingImage(tenantId, type, buffer, data.mimetype);
  return reply.send(result);
}

export async function handleGetSettings(request: FastifyRequest, reply: FastifyReply) {
  const tenantId = (request.user!.tenantId as string);
  const settings = await getTenantSettings(tenantId);
  return reply.send(settings);
}

export async function handleUpdateSettings(request: FastifyRequest, reply: FastifyReply) {
  const tenantId = (request.user!.tenantId as string);
  const updated = await updateTenantSettings(tenantId, request.body);
  return reply.send(updated);
}

export async function handleGetUserSettings(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user!.id;
  const settings = await getUserSettings(userId);
  return reply.send(settings);
}

export async function handleUpdateNotifications(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user!.id;
  const { preferences } = request.body as any;
  const updated = await updateNotificationPreferences(userId, preferences);
  return reply.send({ success: true, notificationPreferences: updated.notificationPreferences });
}

export async function handleToggle2FAEnable(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user!.id;
  await toggle2FA(userId, true);
  return reply.send({ success: true, message: '2FA enabled' });
}

export async function handleToggle2FADisable(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user!.id;
  await toggle2FA(userId, false);
  return reply.send({ success: true, message: '2FA disabled' });
}

export async function handleChangePassword(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user!.id;
  const { currentPassword, newPassword } = request.body as any;
  
  try {
    await changePassword(userId, currentPassword, newPassword);
    return reply.send({ success: true });
  } catch (err: any) {
    if (err.message === 'Current password is incorrect') {
      return reply.status(400).send({ error: err.message });
    }
    return reply.status(500).send({ error: 'Failed to change password' });
  }
}

export async function handleGetSessions(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user!.id;
  const sessions = await getActiveSessions(userId);
  return reply.send({ sessions });
}

export async function handleRevokeSession(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user!.id;
  const { sessionId } = request.params as any;
  await revokeSession(sessionId, userId);
  return reply.send({ success: true });
}

export async function handleRevokeAllOtherSessions(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user!.id;
  // Use authorization token or session ID logic if provided by Better Auth
  // Fastify request might not easily expose the specific sessionId used to authenticate 
  // without digging into the parsed token.
  // Assuming the client passes the current sessionId in the body for this.
  const { currentSessionId } = request.body as any;
  if (!currentSessionId) {
    return reply.status(400).send({ error: 'currentSessionId is required' });
  }
  await revokeAllOtherSessions(currentSessionId, userId);
  return reply.send({ success: true });
}

export async function handleExportData(request: FastifyRequest, reply: FastifyReply) {
  const tenantId = (request.user!.tenantId as string);
  const email = request.user!.email;
  const jobId = await queueExportDataJob(tenantId, email);
  return reply.send({ jobId, message: 'Export started. You will receive an email when ready.' });
}
