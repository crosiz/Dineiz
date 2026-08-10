import { prisma } from '@swiftserve/db';
const { execSync } = require('child_process');
const crypto = require('crypto');

async function run() {
  const user = await prisma.user.findFirst({ where: { role: 'TENANT_ADMIN' } });
  if (!user) return console.log('no user found');
  
  const token = crypto.randomBytes(32).toString('hex');
  await prisma.session.create({
    data: {
      id: crypto.randomUUID(),
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 3600000)
    }
  });

  const curlAuth = `-H "Authorization: Bearer ${token}"`;
  
  const tests = [
    { name: 'GET Customers', cmd: `curl.exe -s -X GET "http://localhost:4000/api/customers" ${curlAuth}` },
    { name: 'POST Customer (Empty strings)', cmd: `curl.exe -s -X POST "http://localhost:4000/api/customers" -H "Content-Type: application/json" ${curlAuth} -d "{\\"name\\":\\"Test User\\",\\"phone\\":\\"\\",\\"email\\":\\"\\"}"` },
    { name: 'POST Customer (Valid data)', cmd: `curl.exe -s -X POST "http://localhost:4000/api/customers" -H "Content-Type: application/json" ${curlAuth} -d "{\\"name\\":\\"Valid User\\",\\"phone\\":\\"123\\",\\"email\\":\\"test@test.com\\"}"` },
    { name: 'GET Customers After Create', cmd: `curl.exe -s -X GET "http://localhost:4000/api/customers" ${curlAuth}` }
  ];

  for (let test of tests) {
    console.log(`\n--- Testing: ${test.name} ---`);
    console.log(`Command: ${test.cmd}`);
    try {
      const out = execSync(test.cmd).toString();
      console.log('Response:', out.substring(0, 500) + (out.length > 500 ? '...' : ''));
    } catch(e: any) {
      console.error('Failed to run curl:', e.message);
    }
  }
}
run();
