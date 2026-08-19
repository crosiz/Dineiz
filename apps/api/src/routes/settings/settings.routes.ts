import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { requireRole } from '../../middleware/auth';
import { 
  handleGetBranding, 
  handleUpdateBranding, 
  handleUploadBrandingImage,
  handleGetSettings,
  handleUpdateSettings,
  handleGetUserSettings,
  handleUpdateNotifications,
  handleToggle2FAEnable,
  handleToggle2FADisable,
  handleChangePassword,
  handleGetSessions,
  handleRevokeSession,
  handleRevokeAllOtherSessions,
  handleExportData,
  handleUploadUserAvatar,
  handleUpdateUserProfile
} from './settings.handlers';

const ADMIN_ROLES = ['SUPER_ADMIN', 'TENANT_ADMIN'];
const MANAGER_ROLES = ['SUPER_ADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER']; // Can access own security settings

export const settingsRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // Tenant Level Settings (Admin Only)
  fastify.get('/api/settings', { preHandler: requireRole(ADMIN_ROLES) }, handleGetSettings);
  fastify.put('/api/settings', { preHandler: requireRole(ADMIN_ROLES) }, handleUpdateSettings);
  
  fastify.get('/api/settings/branding', { preHandler: requireRole(ADMIN_ROLES) }, handleGetBranding);
  fastify.put('/api/settings/branding', { preHandler: requireRole(ADMIN_ROLES) }, handleUpdateBranding);
  fastify.post('/api/settings/branding/upload-image', { preHandler: requireRole(ADMIN_ROLES) }, handleUploadBrandingImage);

  fastify.post('/api/settings/export-data', { preHandler: requireRole(ADMIN_ROLES) }, handleExportData);

  // User Level Settings (Branch Manager + Admin)
  fastify.get('/api/settings/user', { preHandler: requireRole(MANAGER_ROLES) }, handleGetUserSettings);
  fastify.put('/api/settings/user/profile', { preHandler: requireRole(MANAGER_ROLES) }, handleUpdateUserProfile);
  fastify.post('/api/settings/user/avatar', { preHandler: requireRole(MANAGER_ROLES) }, handleUploadUserAvatar);

  fastify.put('/api/settings/notifications', { preHandler: requireRole(MANAGER_ROLES) }, handleUpdateNotifications);
  
  fastify.put('/api/settings/change-password', { preHandler: requireRole(MANAGER_ROLES) }, handleChangePassword);
  
  fastify.post('/api/settings/2fa/enable', { preHandler: requireRole(MANAGER_ROLES) }, handleToggle2FAEnable);
  fastify.post('/api/settings/2fa/disable', { preHandler: requireRole(MANAGER_ROLES) }, handleToggle2FADisable);

  fastify.get('/api/settings/sessions', { preHandler: requireRole(MANAGER_ROLES) }, handleGetSessions);
  fastify.delete('/api/settings/sessions/other', { preHandler: requireRole(MANAGER_ROLES) }, handleRevokeAllOtherSessions);
  fastify.delete('/api/settings/sessions/:sessionId', { preHandler: requireRole(MANAGER_ROLES) }, handleRevokeSession);
};
