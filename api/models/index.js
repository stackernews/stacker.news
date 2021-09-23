import { PrismaClient } from '@prisma/client'

const prisma = global.prisma || new PrismaClient({
  log: ['warn', 'error']
})

global.prisma = prisma

export default prisma
