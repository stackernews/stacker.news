import createPrisma from '@/lib/create-prisma'
import { __DEV__ } from '@/lib/constants'

const prisma = global.prisma || (() => {
  console.log('initing prisma')
  return createPrisma({
    connectionParams: {
      connection_limit: process.env.DB_APP_CONNECTION_LIMIT
    }
  })
})()

if (__DEV__) global.prisma = prisma

export default prisma
