import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { requireRole, requireTenant } from '../../middleware/auth';
import { getFullMenu } from './menu.service';
import {
  handleGetCategories,
  handleCreateCategory,
  handleUpdateCategory,
  handleDeleteCategory,
  handleReorderCategories,
  handleGetItems,
  handleGetItem,
  handleCreateItem,
  handleUpdateItem,
  handleDeleteItem,
  handleToggleAvailability,
  handleBulkToggleAvailability,
  handleToggleCategoryAvailability,
  handleCreateVariation,
  handleUpdateVariation,
  handleDeleteVariation,
  handleCreateAddOn,
  handleUpdateAddOn,
  handleDeleteAddOn,
  handleAIDescription,
  handleBulkUpload,
  handlePublishMenu,
  handleUploadItemImage,
  handleDeleteItemImage,
  handleGetVariations,
  handleGetAddOns,
} from './menu.handlers';

const ADMIN_ROLES = ['SUPER_ADMIN', 'TENANT_ADMIN'];
const ALL_STAFF = ['SUPER_ADMIN', 'TENANT_ADMIN', 'BRANCH_MANAGER'];

export const menuRoutes: FastifyPluginAsyncZod = async (fastify) => {

  fastify.get('/api/menu', { preHandler: requireTenant }, async (req) => {
    return getFullMenu(req.user!.tenantId!, (req.query as any).branchId || req.user?.branchId || undefined);
  });

  // ─── Categories ─────────────────────────────────────────────────────────────
  fastify.get('/api/v1/menu/categories', {
    preHandler: requireTenant,
  }, handleGetCategories);

  fastify.post('/api/v1/menu/categories', {
    preHandler: requireRole(ADMIN_ROLES),
  }, handleCreateCategory);

  fastify.put('/api/v1/menu/categories/reorder', {
    preHandler: requireRole(ADMIN_ROLES),
  }, handleReorderCategories);

  fastify.patch('/api/v1/menu/categories/reorder', {
    preHandler: requireRole(ADMIN_ROLES),
  }, handleReorderCategories);

  fastify.put('/api/v1/menu/categories/:id', {
    preHandler: requireRole(ADMIN_ROLES),
  }, handleUpdateCategory);

  fastify.patch('/api/v1/menu/categories/:id', {
    preHandler: requireRole(ADMIN_ROLES),
  }, handleUpdateCategory);

  fastify.patch('/api/v1/menu/categories/:id/availability', {
    preHandler: requireRole(ADMIN_ROLES),
  }, handleToggleCategoryAvailability);

  fastify.delete('/api/v1/menu/categories/:id', {
    preHandler: requireRole(ADMIN_ROLES),
  }, handleDeleteCategory);

  // ─── Items ──────────────────────────────────────────────────────────────────
  fastify.get('/api/v1/menu/items', {
    preHandler: requireTenant,
  }, handleGetItems);

  fastify.get('/api/v1/menu/items/:id', {
    preHandler: requireTenant,
  }, handleGetItem);

  fastify.post('/api/v1/menu/items', {
    preHandler: requireRole(ADMIN_ROLES),
  }, handleCreateItem);

  fastify.put('/api/v1/menu/items/:id', {
    preHandler: requireRole(ADMIN_ROLES),
  }, handleUpdateItem);

  fastify.patch('/api/v1/menu/items/:id', {
    preHandler: requireRole(ADMIN_ROLES),
  }, handleUpdateItem);

  fastify.delete('/api/v1/menu/items/:id', {
    preHandler: requireRole(ADMIN_ROLES),
  }, handleDeleteItem);

  // Availability toggle — BRANCH_MANAGER can toggle for their branch
  fastify.patch('/api/v1/menu/items/:id/availability', {
    preHandler: requireRole(ALL_STAFF),
  }, handleToggleAvailability);

  fastify.put('/api/v1/menu/items/:id/availability', {
    preHandler: requireRole(ALL_STAFF),
  }, handleToggleAvailability);

  // Bulk availability — POS Stock screen's "Mark Items Unavailable" action
  fastify.put('/api/menu/items/bulk-availability', {
    preHandler: requireRole(ALL_STAFF),
  }, handleBulkToggleAvailability);

  // Image upload/delete
  fastify.post('/api/v1/menu/items/:id/image', {
    preHandler: requireRole(ADMIN_ROLES),
  }, handleUploadItemImage);

  fastify.delete('/api/v1/menu/items/:id/image', {
    preHandler: requireRole(ADMIN_ROLES),
  }, handleDeleteItemImage);

  // ─── Variations ─────────────────────────────────────────────────────────────
  fastify.get('/api/v1/menu/items/:id/variations', {
    preHandler: requireTenant,
  }, handleGetVariations);

  fastify.post('/api/v1/menu/items/:id/variations', {
    preHandler: requireRole(ADMIN_ROLES),
  }, handleCreateVariation);

  fastify.patch('/api/v1/menu/variations/:id', {
    preHandler: requireRole(ADMIN_ROLES),
  }, handleUpdateVariation);

  fastify.put('/api/v1/menu/variations/:id', {
    preHandler: requireRole(ADMIN_ROLES),
  }, handleUpdateVariation);

  fastify.delete('/api/v1/menu/variations/:id', {
    preHandler: requireRole(ADMIN_ROLES),
  }, handleDeleteVariation);

  // ─── Add-ons ────────────────────────────────────────────────────────────────
  fastify.get('/api/v1/menu/items/:id/addons', {
    preHandler: requireTenant,
  }, handleGetAddOns);

  fastify.post('/api/v1/menu/items/:id/addons', {
    preHandler: requireRole(ADMIN_ROLES),
  }, handleCreateAddOn);

  fastify.patch('/api/v1/menu/addons/:id', {
    preHandler: requireRole(ADMIN_ROLES),
  }, handleUpdateAddOn);

  fastify.put('/api/v1/menu/addons/:id', {
    preHandler: requireRole(ADMIN_ROLES),
  }, handleUpdateAddOn);

  fastify.delete('/api/v1/menu/addons/:id', {
    preHandler: requireRole(ADMIN_ROLES),
  }, handleDeleteAddOn);

  // ─── AI Description ─────────────────────────────────────────────────────────
  fastify.post('/api/v1/menu/ai/description', {
    preHandler: requireRole(ALL_STAFF),
  }, handleAIDescription);

  // Legacy path
  fastify.post('/api/menu/ai-description', {
    preHandler: requireRole(ALL_STAFF),
  }, handleAIDescription);

  // ─── Bulk Upload ─────────────────────────────────────────────────────────────
  fastify.post('/api/v1/menu/bulk-upload', {
    preHandler: requireRole(ADMIN_ROLES),
  }, handleBulkUpload);

  // Legacy
  fastify.post('/api/menu/bulk-upload', {
    preHandler: requireRole(ADMIN_ROLES),
  }, handleBulkUpload);

  // ─── Publish ─────────────────────────────────────────────────────────────────
  fastify.post('/api/v1/menu/publish', {
    preHandler: requireRole(ADMIN_ROLES),
  }, handlePublishMenu);
};
