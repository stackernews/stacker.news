const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
async function main () {
  const k00b = await prisma.user.upsert({
    where: { name: 'k00b' },
    update: {},
    create: {
      name: 'k00b'
    }
  })
  const satoshi = await prisma.user.upsert({
    where: { name: 'satoshi' },
    update: {},
    create: {
      name: 'satoshi'
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
      title: 'System76 Developing “Cosmic” Desktop Environment',
      url: 'https://blog.system76.com/post/648371526931038208/cosmic-to-arrive-in-june-release-of-popos-2104',
      userId: satoshi.id
    }
  })

  await prisma.item.upsert({
    where: { id: 1 },
    update: {},
    create: {
      title: 'Deno 1.9',
      url: 'https://deno.com/blog/v1.9',
      userId: k00b.id
    }
  })

  await prisma.item.upsert({
    where: { id: 2 },
    update: {},
    create: {
      title: '1Password Secrets Automation',
      url: 'https://blog.1password.com/introducing-secrets-automation/',
      userId: greg.id
    }
  })

  await prisma.item.upsert({
    where: { id: 3 },
    update: {},
    create: {
      title: '‘Counter Strike’ Bug Allows Hackers to Take over a PC with a Steam Invite',
      url: 'https://www.vice.com/en/article/dyvgej/counter-strike-bug-allows-hackers-to-take-over-a-pc-with-a-steam-invite',
      userId: stan.id
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
