import { PrismaClient } from '@prisma/client'

global.prisma ||= new PrismaClient({
  log: ['warn', 'error']
})

export default global.prisma
