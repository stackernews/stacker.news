import { PrismaClient } from '@prisma/client'

export default function newPrismaClient ({ options = {}, connectionParams = {} }) {
  const url = new URL(process.env.DATABASE_URL)
  for (const [key, value] of Object.entries(connectionParams)) {
    if (value === undefined) continue
    url.searchParams.set(key, value)
  }

  const prisma = new PrismaClient({
    datasourceUrl: url.toString(),
    ...options,
    transactionOptions: {
      timeout: process.env.DB_TRANSACTION_TIMEOUT ? parseInt(process.env.DB_TRANSACTION_TIMEOUT) : undefined,
      ...options.transactionOptions
    }
  })

  prisma.$on('query', (e) => {
    if (process.env.PRISMA_SLOW_LOGS_MS && e.duration > process.env.PRISMA_SLOW_LOGS_MS) {
      console.log('Query: ' + e.query)
      console.log('Params: ' + e.params)
      console.log('Duration: ' + e.duration + 'ms')
    }
  })

  return prisma
}
