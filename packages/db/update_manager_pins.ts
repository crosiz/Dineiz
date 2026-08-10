import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(pin).digest('hex')
}

async function main() {
  const managers = await prisma.user.findMany({
    where: {
      role: { in: ['TENANT_ADMIN', 'BRANCH_MANAGER'] },
    }
  })

  console.log(`Found ${managers.length} managers/admins. Updating posPin...`)

  const hashed = hashPin('1234') // Default manager PIN to 1234
  
  for (const manager of managers) {
    await prisma.user.update({
      where: { id: manager.id },
      data: { posPin: hashed }
    })
    console.log(`Updated ${manager.email} to PIN 1234`)
  }

  console.log('Done.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
