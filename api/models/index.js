import { PrismaClient } from '@prisma/client'

if (!global.prisma) {
  global.prisma = new PrismaClient({
    log: [{ level: 'query', emit: 'event' }, 'warn', 'error']
  })
  global.prisma.$on('query', (e) => {
    if (e.duration > 50) {
      console.log('Query: ' + e.query)
      console.log('Params: ' + e.params)
      console.log('Duration: ' + e.duration + 'ms')
    }
  })
}

export default global.prisma
