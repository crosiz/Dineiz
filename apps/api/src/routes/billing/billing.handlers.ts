import { FastifyRequest, FastifyReply } from 'fastify';
import { getTenantSubscription, getPaymentHistory, changePlan, PLANS } from './billing.service';

export async function handleGetSubscription(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user!;
  try {
    const sub = await getTenantSubscription(user.tenantId!);
    return reply.send(sub);
  } catch (error: any) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Failed to fetch subscription' });
  }
}

export async function handleGetHistory(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user!;
  try {
    const history = await getPaymentHistory(user.tenantId!);
    return reply.send({ payments: history });
  } catch (error: any) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Failed to fetch payment history' });
  }
}

export async function handleGetPlans(request: FastifyRequest, reply: FastifyReply) {
  return reply.send(PLANS);
}

export async function handleChangePlan(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user!;
  const { newPlan, billingCycle } = request.body as any;
  try {
    const result = await changePlan(user.tenantId!, newPlan, billingCycle);
    return reply.send(result);
  } catch (error: any) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Failed to change plan' });
  }
}

export async function handleGetInvoice(request: FastifyRequest, reply: FastifyReply) {
  const { paymentId } = request.params as any;
  // Mock PDF return for now
  reply.header('Content-Type', 'application/pdf');
  reply.header('Content-Disposition', `attachment; filename="invoice-${paymentId}.pdf"`);
  return reply.send(Buffer.from('%PDF-1.4\n1 0 obj\n<< /Title (Mock Invoice) >>\nendobj\n'));
}
