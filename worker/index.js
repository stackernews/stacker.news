// environment variables are loaded from files and imports run before the rest of the code
import './loadenv'
import PgBoss from 'pg-boss'
import createPrisma from '@/lib/create-prisma'
import {
  autoDropBolt11s, checkInvoice, checkPendingDeposits, checkPendingWithdrawals,
  checkWithdrawal,
  finalizeHodlInvoice, subscribeToWallet
} from './wallet'
import { repin } from './repin'
import { trust } from './trust'
import { earn } from './earn'
import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client'
import { indexItem, indexAllItems } from './search'
import { timestampItem } from './ots'
import { computeStreaks, checkStreak } from './streak'
import { nip57 } from './nostr'
import fetch from 'cross-fetch'
import { authenticatedLndGrpc } from '@/lib/lnd'
import { views, rankViews } from './views'
import { imgproxy } from './imgproxy'
import { deleteItem } from './ephemeralItems'
import { deleteUnusedImages } from './deleteUnusedImages'
import { territoryBilling, territoryRevenue } from './territory'
import { ofac } from './ofac'
import { autoWithdraw } from './autowithdraw'
import { saltAndHashEmails } from './saltAndHashEmails'
import { remindUser } from './reminder'
import {
  paidActionPaid, paidActionForwarding, paidActionForwarded,
  paidActionFailedForward, paidActionHeld, paidActionFailed,
  paidActionCanceling
} from './paidAction'
import { thisDay } from './thisDay'
import { isServiceEnabled } from '@/lib/sndev'
import { payWeeklyPostBounty, weeklyPost } from './weeklyPosts'
import { expireBoost } from './expireBoost'
import { payingActionConfirmed, payingActionFailed } from './payingAction'

async function work () {
  const boss = new PgBoss(process.env.DATABASE_URL)
  const models = createPrisma({
    connectionParams: { connection_limit: process.env.DB_WORKER_CONNECTION_LIMIT }
  })

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

  if (isServiceEnabled('payments')) {
    await subscribeToWallet(args)
    await boss.work('finalizeHodlInvoice', jobWrapper(finalizeHodlInvoice))
    await boss.work('checkPendingDeposits', jobWrapper(checkPendingDeposits))
    await boss.work('checkPendingWithdrawals', jobWrapper(checkPendingWithdrawals))
    await boss.work('autoDropBolt11s', jobWrapper(autoDropBolt11s))
    await boss.work('autoWithdraw', jobWrapper(autoWithdraw))
    await boss.work('checkInvoice', jobWrapper(checkInvoice))
    await boss.work('checkWithdrawal', jobWrapper(checkWithdrawal))
    // paidAction jobs
    await boss.work('paidActionForwarding', jobWrapper(paidActionForwarding))
    await boss.work('paidActionForwarded', jobWrapper(paidActionForwarded))
    await boss.work('paidActionFailedForward', jobWrapper(paidActionFailedForward))
    await boss.work('paidActionHeld', jobWrapper(paidActionHeld))
    await boss.work('paidActionCanceling', jobWrapper(paidActionCanceling))
    await boss.work('paidActionFailed', jobWrapper(paidActionFailed))
    await boss.work('paidActionPaid', jobWrapper(paidActionPaid))
    // payingAction jobs
    await boss.work('payingActionFailed', jobWrapper(payingActionFailed))
    await boss.work('payingActionConfirmed', jobWrapper(payingActionConfirmed))
  }
  if (isServiceEnabled('search')) {
    await boss.work('indexItem', jobWrapper(indexItem))
    await boss.work('indexAllItems', jobWrapper(indexAllItems))
  }
  if (isServiceEnabled('images')) {
    await boss.work('imgproxy', jobWrapper(imgproxy))
    await boss.work('deleteUnusedImages', jobWrapper(deleteUnusedImages))
  }
  await boss.work('expireBoost', jobWrapper(expireBoost))
  await boss.work('weeklyPost-*', jobWrapper(weeklyPost))
  await boss.work('payWeeklyPostBounty', jobWrapper(payWeeklyPostBounty))
  await boss.work('repin-*', jobWrapper(repin))
  await boss.work('trust', jobWrapper(trust))
  await boss.work('timestampItem', jobWrapper(timestampItem))
  await boss.work('earn', jobWrapper(earn))
  await boss.work('streak', jobWrapper(computeStreaks))
  await boss.work('checkStreak', jobWrapper(checkStreak))
  await boss.work('nip57', jobWrapper(nip57))
  await boss.work('views-*', jobWrapper(views))
  await boss.work('rankViews', jobWrapper(rankViews))
  await boss.work('deleteItem', jobWrapper(deleteItem))
  await boss.work('territoryBilling', jobWrapper(territoryBilling))
  await boss.work('territoryRevenue', jobWrapper(territoryRevenue))
  await boss.work('ofac', jobWrapper(ofac))
  await boss.work('saltAndHashEmails', jobWrapper(saltAndHashEmails))
  await boss.work('reminder', jobWrapper(remindUser))
  await boss.work('thisDay', jobWrapper(thisDay))

  console.log('working jobs')
}

work()
