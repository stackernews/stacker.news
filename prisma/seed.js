const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
async function main () {
  const k00b = await prisma.user.upsert({
    where: { name: 'k00b' },
    update: {},
    create: {
      name: 'k00b',
      messages: {
        create: {
          text: 'Hello world'
        }
      }
    }
  })
  const satoshi = await prisma.user.upsert({
    where: { name: 'satoshi' },
    update: {},
    create: {
      name: 'satoshi',
      messages: {
        create: [
          {
            text: 'Peer to peer digital cash'
          },
          {
            text: 'Reengineer the world'
          }
        ]
      }
    }
  })
  console.log({ k00b, satoshi })
}
main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
