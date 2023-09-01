const PgBoss = require('pg-boss')
require('@next/env').loadEnvConfig('..')
const { PrismaClient } = require('@prisma/client')
const { checkInvoice, checkWithdrawal } = require('./wallet')
const { repin } = require('./repin')
const { trust } = require('./trust')
const { auction } = require('./auction')
const { updateCsvs } = require('./csv')
const { earn } = require('./earn')
const { ApolloClient, HttpLink, InMemoryCache } = require('@apollo/client')
const { indexItem, indexAllItems } = require('./search')
const { timestampItem } = require('./ots')
const { computeStreaks, checkStreak } = require('./streak')
const { nip57 } = require('./nostr')

const fetch = require('cross-fetch')
const { authenticatedLndGrpc } = require('ln-service')
const { views, rankViews } = require('./views')

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

  const { lnd } = authenticatedLndGrpc({
    cert: process.env.LND_CERT,
    macaroon: process.env.LND_MACAROON,
    socket: process.env.LND_SOCKET
  })

  const args = { boss, models, apollo, lnd }

  boss.on('error', error => console.error(error))

  boss.schedule('updateCsvs', '* * * * *')

  await boss.start()
  await boss.work('checkInvoice', checkInvoice(args))
  await boss.work('checkWithdrawal', checkWithdrawal(args))
  await boss.work('repin-*', repin(args))
  await boss.work('trust', trust(args))
  await boss.work('timestampItem', timestampItem(args))
  await boss.work('indexItem', indexItem(args))
  await boss.work('indexAllItems', indexAllItems(args))
  await boss.work('auction', auction(args))
  await boss.work('earn', earn(args))
  await boss.work('streak', computeStreaks(args))
  await boss.work('checkStreak', checkStreak(args))
  await boss.work('nip57', nip57(args))
  await boss.work('views', views(args))
  await boss.work('rankViews', rankViews(args))
  await boss.work('updateCsvs', updateCsvs(args))

  console.log('working jobs')
}

work()
