import * as jwt from "jsonwebtoken";
import { PrismaClient } from '@prisma/client';

const JWT_SECRET = process.env.MOBILE_JWT_SECRET || 'super-secret-mobile-jwt-key';

async function testApi() {
  const token = jwt.sign({
    userId: "cmrz8rbuf000035fyy2svryrj",
    tenantId: null, // As it would be before onboarding
    purpose: "access"
  }, JWT_SECRET);

  console.log("Token:", token);

  const res = await fetch("http://localhost:8082/api/mobile/menu/items", {
    headers: { Authorization: `Bearer ${token}` }
  });

  const data = await res.json();
  console.log("Response:", JSON.stringify(data, null, 2));
}

testApi();
