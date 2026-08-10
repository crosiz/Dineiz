import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { prisma } from "@dineiz/db";
import { mobileAuthMiddleware, MobileJwtPayload } from "../../middleware/mobileAuth.middleware";
import crypto from "crypto";

export const mobileOnboardingRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.post(
    "/api/mobile/onboarding/complete",
    {
      preHandler: mobileAuthMiddleware,
      schema: {
        body: z.object({
          restaurantName: z.string().min(2),
          businessType: z.string().min(2),
          city: z.string().min(2),
          phone: z.string(),
          initialMenu: z.array(z.object({
            name: z.string(),
            price: z.number().positive(),
            category: z.string()
          })).optional()
        }),
      },
    },
    async (request, reply) => {
      const { restaurantName, businessType, city, phone, initialMenu } = request.body as any;
      const mobileUserReq = (request as any).mobileUser as MobileJwtPayload;

      // Check if user already has a tenant to prevent multiple tenant creation per mobile user
      const existingUser = await prisma.user.findUnique({
        where: { id: mobileUserReq.userId }
      });

      if (existingUser?.tenantId) {
        return reply.status(400).send({ success: false, error: "User already has a tenant" });
      }

      try {
        const result = await prisma.$transaction(async (tx) => {
          // 1. Create Tenant
          const tenant = await tx.tenant.create({
            data: {
              name: restaurantName,
              plan: "MOBILE_LITE",
              registrationSource: "MOBILE",
              primaryPhone: phone
            }
          });

          // 3. Generate Branch Code
          const cityCode = city.substring(0, 3).toUpperCase();
          const randomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase();
          const branchCode = `SS-${cityCode}-${randomSuffix}`;

          // 2. Create Branch
          const branch = await tx.branch.create({
            data: {
              tenantId: tenant.id,
              name: "Main Branch",
              city: city,
              phone: phone,
              branchCode: branchCode,
              currency: "PKR",
              taxRate: 0,
              isActive: true
            }
          });

          // 5. Create TenantSubscription
          const thirtyDaysFromNow = new Date();
          thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
          
          const subscription = await tx.tenantSubscription.create({
            data: {
              tenantId: tenant.id,
              plan: "MOBILE_LITE",
              billingCycle: "MONTHLY",
              status: "ACTIVE", // 30 day trial
              nextRenewalDate: thirtyDaysFromNow
            }
          });

          // 6. Link User
          await tx.user.update({
            where: { id: mobileUserReq.userId },
            data: { 
              tenantId: tenant.id,
              branchId: branch.id
            }
          });

          // 7. & 8. Create Categories and Items
          let categoriesData: any[] = [];
          let itemsData: any[] = [];
          
          if (initialMenu && initialMenu.length > 0) {
            // Group by category string
            const catNames = Array.from(new Set(initialMenu.map(i => i.category)));
            
            for (const cName of catNames) {
              const cat = await tx.category.create({
                data: {
                  tenantId: tenant.id,
                  name: cName
                }
              });
              
              // Create BranchMenuCategory
              await tx.branchMenuCategory.create({
                data: {
                  branchId: branch.id,
                  categoryId: cat.id,
                  isAvailable: true
                }
              });

              categoriesData.push(cat);

              const itemsInCat = initialMenu.filter(i => i.category === cName);
              for (const itemInput of itemsInCat) {
                const item = await tx.item.create({
                  data: {
                    tenantId: tenant.id,
                    categoryId: cat.id,
                    name: itemInput.name,
                    basePrice: itemInput.price,
                    isAvailable: true
                  }
                });

                // Create BranchMenuItem
                await tx.branchMenuItem.create({
                  data: {
                    branchId: branch.id,
                    itemId: item.id,
                    isAvailable: true,
                    isInStock: true,
                    overridePrice: itemInput.price
                  }
                });

                itemsData.push(item);
              }
            }
          } else {
            // Defaults based on business type (e.g. Biryani -> Biryani, Drinks, Extras)
            let defaultCategories = ["Mains", "Drinks", "Extras"];
            if (businessType.toLowerCase().includes("biryani")) {
              defaultCategories = ["Biryani", "Drinks", "Extras"];
            }

            for (const cName of defaultCategories) {
              const cat = await tx.category.create({
                data: { tenantId: tenant.id, name: cName }
              });
              await tx.branchMenuCategory.create({
                data: { branchId: branch.id, categoryId: cat.id, isAvailable: true }
              });
              categoriesData.push(cat);
            }
          }

          // 9. Default KdsStation
          await tx.kdsStation.create({
            data: {
              tenantId: tenant.id,
              branchId: branch.id,
              name: "Kitchen",
              catchAll: true, // Small kitchen defaults to catch-all
              isActive: true
            }
          });

          return {
            tenantId: tenant.id,
            branchId: branch.id,
            branchCode,
            branding: {
              restaurantName: tenant.name,
              primaryColor: tenant.colorPrimary,
              logoUrl: tenant.logoUrl,
              phone: tenant.primaryPhone
            },
            categories: categoriesData,
            items: itemsData,
            subscriptionStatus: subscription.status
          };
        });

        return { success: true, data: result };

      } catch (err: any) {
        request.log.error(err);
        return reply.status(500).send({ success: false, error: "Onboarding failed. Please try again." });
      }
    }
  );
};
