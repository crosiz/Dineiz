import { FastifyRequest, FastifyReply } from 'fastify';
import { listPromos, createPromo, listCombos, createCombo, listBxGy, createBxGy, validateDeals, listUnifiedDeals, createUnifiedDeal, getUnifiedDeal, updateUnifiedDeal, deleteUnifiedDeal, toggleUnifiedDeal, evaluateEligibleDeals, validatePromoCodeUnified } from './deals.service';

export async function handleListPromos(req: FastifyRequest, reply: FastifyReply) {
  return listPromos(req.user!.tenantId!);
}
export async function handleCreatePromo(req: FastifyRequest, reply: FastifyReply) {
  const promo = await createPromo(req.user!.tenantId!, req.body as any);
  return reply.status(201).send(promo);
}
export async function handleListCombos(req: FastifyRequest, reply: FastifyReply) {
  return listCombos(req.user!.tenantId!);
}
export async function handleCreateCombo(req: FastifyRequest, reply: FastifyReply) {
  const combo = await createCombo(req.user!.tenantId!, req.body as any);
  return reply.status(201).send(combo);
}
export async function handleListBxGy(req: FastifyRequest, reply: FastifyReply) {
  return listBxGy(req.user!.tenantId!);
}
export async function handleCreateBxGy(req: FastifyRequest, reply: FastifyReply) {
  const deal = await createBxGy(req.user!.tenantId!, req.body as any);
  return reply.status(201).send(deal);
}
export async function handleValidateDeals(req: FastifyRequest, reply: FastifyReply) {
  return validateDeals(req.user!.tenantId!, req.body as any);
}

// -----------------------------------------------------------------------------
// UNIFIED DEALS HANDLERS
// -----------------------------------------------------------------------------

export async function handleListUnifiedDeals(req: FastifyRequest<{ Querystring: { branchId?: string, status?: string, type?: string } }>, reply: FastifyReply) {
  return listUnifiedDeals(req.user!.tenantId!, req.query);
}

export async function handleGetUnifiedDeal(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  return getUnifiedDeal(req.user!.tenantId!, req.params.id);
}

export async function handleCreateUnifiedDeal(req: FastifyRequest, reply: FastifyReply) {
  const deal = await createUnifiedDeal(req.user!.tenantId!, req.body);
  return reply.status(201).send(deal);
}

export async function handleUpdateUnifiedDeal(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const deal = await updateUnifiedDeal(req.user!.tenantId!, req.params.id, req.body);
  return reply.send(deal);
}

export async function handleDeleteUnifiedDeal(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  await deleteUnifiedDeal(req.user!.tenantId!, req.params.id);
  return reply.status(204).send();
}

export async function handleToggleUnifiedDeal(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  const result = await toggleUnifiedDeal(req.user!.tenantId!, req.params.id);
  return reply.send(result);
}

// -----------------------------------------------------------------------------
// POS DEALS HANDLERS
// -----------------------------------------------------------------------------

export async function handlePosEligibleDeals(req: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) {
  const query = req.query;
  const eligible = await evaluateEligibleDeals(req.user!.tenantId!, query.branchId, Number(query.orderTotal), query.orderType, query.items ? JSON.parse(query.items) : [], query.time);
  return reply.send(eligible);
}

export async function handlePosValidatePromo(req: FastifyRequest<{ Body: any }>, reply: FastifyReply) {
  const body = req.body;
  const deal = await validatePromoCodeUnified(req.user!.tenantId!, body.branchId, body.orderTotal, body.orderType, body.items, body.promoCode);
  return reply.send(deal);
}
