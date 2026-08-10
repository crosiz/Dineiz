import { prisma } from '@swiftserve/db';
import { getMeili } from '../lib/meili';

export async function syncMenuToMeili(tenantId: string) {
  const meili = getMeili();

  const categories = await prisma.category.findMany({
    where: { tenantId },
    include: { items: true },
  });

  const docs = categories.flatMap((c) =>
    c.items.map((i) => ({
      id: i.id,
      tenantId,
      categoryId: c.id,
      categoryName: c.name,
      name: i.name,
      description: i.description ?? '',
      basePrice: i.basePrice,
      isAvailable: i.isAvailable,
      image: i.image ?? null,
      updatedAt: i.updatedAt,
    }))
  );

  const index = meili.index(`menu_${tenantId}`);
  await index.updateSearchableAttributes(['name', 'description', 'categoryName']);
  await index.updateFilterableAttributes(['tenantId', 'categoryId', 'isAvailable']);
  await index.addDocuments(docs, { primaryKey: 'id' });

  return { indexed: docs.length };
}

export async function syncCustomersToMeili(tenantId: string) {
  const meili = getMeili();

  // Customer model is added in Task 65; for now we safely no-op if table doesn't exist in DB yet.
  const anyPrisma = prisma as any;
  if (!anyPrisma.customer?.findMany) return { indexed: 0 };

  const customers = await anyPrisma.customer.findMany({
    where: { tenantId },
  });

  const docs = customers.map((c: any) => ({
    id: c.id,
    tenantId,
    name: c.name,
    phone: c.phone,
    email: c.email,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }));

  const index = meili.index(`customers_${tenantId}`);
  await index.updateSearchableAttributes(['name', 'phone', 'email']);
  await index.updateFilterableAttributes(['tenantId']);
  await index.addDocuments(docs, { primaryKey: 'id' });

  return { indexed: docs.length };
}

