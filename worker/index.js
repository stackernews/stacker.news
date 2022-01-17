const PgBoss = require('pg-boss')
const dotenv = require('dotenv')
dotenv.config({ path: '..' })
const { PrismaClient } = require('@prisma/client')
const { checkInvoice, checkWithdrawal } = require('./wallet')
const { repin } = require('./repin')
const { trust } = require('./trust')

async function work () {
  const boss = new PgBoss(process.env.DATABASE_URL)
  const models = new PrismaClient()
  const args = { boss, models }

  boss.on('error', error => console.error(error))

  await boss.start()
  await boss.work('checkInvoice', checkInvoice(args))
  await boss.work('checkWithdrawal', checkWithdrawal(args))
  await boss.work('repin-*', repin(args))
  await boss.work('trust', trust(args))

  console.log('working jobs')
}

work()
