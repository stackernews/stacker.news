import { PrismaClient } from '@prisma/client'

const prisma = global.prisma || (() => {
  console.log('initing prisma')
  const prisma = new PrismaClient({
    log: [{ level: 'query', emit: 'event' }, 'warn', 'error']
  })
  prisma.$on('query', (e) => {
    if (process.env.PRISMA_SLOW_LOGS_MS && e.duration > process.env.PRISMA_SLOW_LOGS_MS) {
      console.log('Query: ' + e.query)
      console.log('Params: ' + e.params)
      console.log('Duration: ' + e.duration + 'ms')
    }
  })
  return prisma
})()

if (process.env.NODE_ENV === 'development') global.prisma = prisma

export default prisma
