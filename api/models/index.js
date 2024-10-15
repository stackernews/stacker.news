import createPrisma from '@/lib/create-prisma'

const prisma = global.prisma || (() => {
  console.log('initing prisma')
  return createPrisma({
    connectionParams: {
      connection_limit: process.env.DB_APP_CONNECTION_LIMIT
    }
  })
})()

if (process.env.NODE_ENV === 'development') global.prisma = prisma

export default prisma
