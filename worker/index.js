import PgBoss from 'pg-boss'
import nextEnv from '@next/env'
import { PrismaClient } from '@prisma/client'
import { checkInvoice, checkWithdrawal } from './wallet.js'
import { repin } from './repin.js'
import { trust } from './trust.js'
import { auction } from './auction.js'
import { earn } from './earn.js'
import apolloClient from '@apollo/client'
import { indexItem, indexAllItems } from './search.js'
import { timestampItem } from './ots.js'
import { computeStreaks, checkStreak } from './streak.js'
import { nip57 } from './nostr.js'
import fetch from 'cross-fetch'
import { authenticatedLndGrpc } from 'ln-service'
import { views, rankViews } from './views.js'
import { imgproxy } from './imgproxy.js'

const { loadEnvConfig } = nextEnv
const { ApolloClient, HttpLink, InMemoryCache } = apolloClient

loadEnvConfig('..')

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
  await boss.work('imgproxy', imgproxy(args))

  console.log('working jobs')
}

work()
