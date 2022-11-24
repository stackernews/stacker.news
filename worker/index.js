const PgBoss = require('pg-boss')
const dotenv = require('dotenv')
dotenv.config({ path: '..' })
const { PrismaClient } = require('@prisma/client')
const { checkInvoice, checkWithdrawal } = require('./wallet')
const { repin } = require('./repin')
const { trust } = require('./trust')
const { auction } = require('./auction')
const { earn } = require('./earn')
const { ApolloClient, HttpLink, InMemoryCache } = require('@apollo/client')
const { indexItem, indexAllItems } = require('./search')
const fetch = require('cross-fetch')

async function work () {
  const boss = new PgBoss(process.env.DATABASE_URL)
  const models = new PrismaClient()
  const apollo = new ApolloClient({
    link: new HttpLink({
      uri: `${process.env.SELF_URL}/api/graphql`,
      fetch
    }),
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: {
        fetchPolicy: 'no-cache',
        nextFetchPolicy: 'no-cache'
      },
      query: {
        fetchPolicy: 'no-cache',
        nextFetchPolicy: 'no-cache'
      }
    }
  })

  const args = { boss, models, apollo }

  boss.on('error', error => console.error(error))

  await boss.start()
  await boss.work('checkInvoice', checkInvoice(args))
  await boss.work('checkWithdrawal', checkWithdrawal(args))
  await boss.work('repin-*', repin(args))
  await boss.work('trust', trust(args))
  await boss.work('indexItem', indexItem(args))
  await boss.work('indexAllItems', indexAllItems(args))
  await boss.work('auction', auction(args))
  await boss.work('earn', earn(args))

  console.log('working jobs')
}

work()
