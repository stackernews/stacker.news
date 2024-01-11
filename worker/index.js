import PgBoss from 'pg-boss'
import nextEnv from '@next/env'
import { PrismaClient } from '@prisma/client'
import {
  autoDropBolt11s, checkPendingDeposits, checkPendingWithdrawals,
  finalizeHodlInvoice, subscribeToWallet, autoWithdraw
} from './wallet.js'
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
import { deleteItem } from './ephemeralItems.js'
import { deleteUnusedImages } from './deleteUnusedImages.js'
import { territoryBilling } from './territory.js'
import { ofac } from './ofac.js'

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

  function jobWrapper (fn) {
    return async function (job) {
      console.log(`running ${job.name} with args`, job.data)
      try {
        await fn({ ...job, ...args })
      } catch (error) {
        console.error(`error running ${job.name}`, error)
        throw error
      }
      console.log(`finished ${job.name}`)
    }
  }

  await boss.start()

  await subscribeToWallet(args)
  await boss.work('finalizeHodlInvoice', jobWrapper(finalizeHodlInvoice))
  await boss.work('checkPendingDeposits', jobWrapper(checkPendingDeposits))
  await boss.work('checkPendingWithdrawals', jobWrapper(checkPendingWithdrawals))
  await boss.work('autoDropBolt11s', jobWrapper(autoDropBolt11s))
  await boss.work('autoWithdraw', jobWrapper(autoWithdraw))
  await boss.work('repin-*', jobWrapper(repin))
  await boss.work('trust', jobWrapper(trust))
  await boss.work('timestampItem', jobWrapper(timestampItem))
  await boss.work('indexItem', jobWrapper(indexItem))
  await boss.work('indexAllItems', jobWrapper(indexAllItems))
  await boss.work('auction', jobWrapper(auction))
  await boss.work('earn', jobWrapper(earn))
  await boss.work('streak', jobWrapper(computeStreaks))
  await boss.work('checkStreak', jobWrapper(checkStreak))
  await boss.work('nip57', jobWrapper(nip57))
  await boss.work('views', jobWrapper(views))
  await boss.work('rankViews', jobWrapper(rankViews))
  await boss.work('imgproxy', jobWrapper(imgproxy))
  await boss.work('deleteItem', jobWrapper(deleteItem))
  await boss.work('deleteUnusedImages', jobWrapper(deleteUnusedImages))
  await boss.work('territoryBilling', jobWrapper(territoryBilling))
  await boss.work('ofac', jobWrapper(ofac))

  console.log('working jobs')
}

work()
