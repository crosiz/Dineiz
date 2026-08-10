import { FastifyInstance } from 'fastify';
import { mobileOnboardingRoutes } from './onboarding';
import { mobileRestaurantRoutes } from './restaurant';
import { mobileMenuRoutes } from './menu';
import { mobileOrdersRoutes } from './orders';
import { mobileSettingsRoutes } from './settings';
import { mobileNotificationsRoutes } from './notifications';
import { mobileTablesRoutes } from './tables';

export const mobileFeatureRoutes = async (fastify: FastifyInstance) => {
  await fastify.register(mobileOnboardingRoutes);
  await fastify.register(mobileRestaurantRoutes);
  await fastify.register(mobileMenuRoutes);
  await fastify.register(mobileOrdersRoutes);
  await fastify.register(mobileSettingsRoutes);
  await fastify.register(mobileNotificationsRoutes);
  await fastify.register(mobileTablesRoutes);
};
