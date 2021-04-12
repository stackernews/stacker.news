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
  const greg = await prisma.user.upsert({
    where: { name: 'greg' },
    update: {},
    create: {
      name: 'greg'
    }
  })
  const stan = await prisma.user.upsert({
    where: { name: 'stan' },
    update: {},
    create: {
      name: 'stan'
    }
  })

  await prisma.item.upsert({
    where: { id: 0 },
    update: {},
    create: {
      text: 'A',
      userId: satoshi.id,
      children: {
        create: [
          {
            text: 'B',
            userId: k00b.id,
            children: {
              create: [
                {
                  text: 'G',
                  userId: satoshi.id,
                  children: {
                    create: [
                      {
                        text: 'H',
                        userId: greg.id
                      }
                    ]
                  }
                }
              ]
            }
          },
          {
            text: 'C',
            userId: k00b.id,
            children: {
              create: [
                {
                  text: 'D',
                  userId: satoshi.id
                },
                {
                  text: 'E',
                  userId: greg.id
                },
                {
                  text: 'F',
                  userId: stan.id
                }
              ]
            }
          }
        ]
      }
    }
  })
}
main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
