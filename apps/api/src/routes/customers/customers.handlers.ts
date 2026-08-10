import { FastifyRequest, FastifyReply } from 'fastify';
import { CustomersService } from './customers.service';

export async function listCustomersHandler(
  req: FastifyRequest,
  reply: FastifyReply
) {
  const tenantId = (req as any).user.tenantId;
  const result = await CustomersService.listCustomers(tenantId, (req as any).query);
  return reply.send(result);
}

export async function getCustomerHandler(
  req: FastifyRequest,
  reply: FastifyReply
) {
  const tenantId = (req as any).user.tenantId;
  const customer = await CustomersService.getCustomerById(tenantId, (req as any).params.id);
  
  if (!customer) {
    return reply.status(404).send({ error: 'Customer not found' });
  }
  
  return reply.send(customer);
}

export async function lookupCustomerHandler(
  req: FastifyRequest,
  reply: FastifyReply
) {
  const tenantId = (req as any).user.tenantId;
  const customer = await CustomersService.lookupCustomerByPhone(tenantId, (req as any).query.phone);
  
  if (!customer) {
    return reply.status(404).send({ found: false });
  }
  
  return reply.send({ found: true, customer });
}

export async function createCustomerHandler(
  req: FastifyRequest,
  reply: FastifyReply
) {
  const tenantId = (req as any).user.tenantId;
  const customer = await CustomersService.createCustomer(tenantId, (req as any).body);
  return reply.status(201).send(customer);
}

export async function updateCustomerHandler(
  req: FastifyRequest,
  reply: FastifyReply
) {
  const tenantId = (req as any).user.tenantId;
  const customer = await CustomersService.updateCustomer(tenantId, (req as any).params.id, (req as any).body);
  return reply.send(customer);
}

export async function deleteCustomerHandler(
  req: FastifyRequest,
  reply: FastifyReply
) {
  const tenantId = (req as any).user.tenantId;
  await CustomersService.deleteCustomer(tenantId, (req as any).params.id);
  return reply.send({ success: true });
}

export async function addNoteHandler(
  req: FastifyRequest,
  reply: FastifyReply
) {
  const tenantId = (req as any).user.tenantId;
  const staffName = (req as any).user.name || 'Staff';
  
  const note = await CustomersService.addNote(tenantId, (req as any).params.id, staffName, (req as any).body.noteText);
  return reply.send(note);
}

export async function getCustomerOrdersHandler(
  req: FastifyRequest,
  reply: FastifyReply
) {
  const tenantId = (req as any).user.tenantId;
  const result = await CustomersService.getCustomerOrders(tenantId, (req as any).params.id, (req as any).query);
  return reply.send(result);
}

export async function getCustomerLoyaltyHandler(
  req: FastifyRequest,
  reply: FastifyReply
) {
  const tenantId = (req as any).user.tenantId;
  const result = await CustomersService.getCustomerLoyalty(tenantId, (req as any).params.id, (req as any).query);
  return reply.send(result);
}

export async function adjustPointsHandler(
  req: FastifyRequest,
  reply: FastifyReply
) {
  const tenantId = (req as any).user.tenantId;
  const userId = (req as any).user.id;
  const result = await CustomersService.adjustPoints(tenantId, (req as any).params.id, userId, (req as any).body);
  return reply.send(result);
}

export async function importCustomersHandler(
  req: FastifyRequest,
  reply: FastifyReply
) {
  const tenantId = (req as any).user.tenantId;
  const branchId = (req as any).user.branchId;
  const result = await CustomersService.importCustomers(tenantId, branchId, (req as any).body.customers);
  return reply.send(result);
}
