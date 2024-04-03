import { authenticatedLndGrpc, createInvoice } from 'ln-service'
import { msatsToSats, numWithUnits, satsToMsats } from '@/lib/format'
import { datePivot } from '@/lib/time'
import { createWithdrawal, sendToLnAddr, addWalletLog } from '@/api/resolvers/wallet'

export async function autoWithdraw ({ data: { id }, models, lnd }) {
  const user = await models.user.findUnique({ where: { id } })
  if (user.autoWithdrawThreshold === null || user.autoWithdrawMaxFeePercent === null) return

  const threshold = satsToMsats(user.autoWithdrawThreshold)
  const excess = Number(user.msats - threshold)

  // excess must be greater than 10% of threshold
  if (excess < Number(threshold) * 0.1) return

  const maxFee = msatsToSats(Math.ceil(excess * (user.autoWithdrawMaxFeePercent / 100.0)))
  const amount = msatsToSats(excess) - maxFee

  // must be >= 1 sat
  if (amount < 1) return

  // check that
  // 1. the user doesn't have an autowithdraw pending
  // 2. we have not already attempted to autowithdraw this fee recently
  const [pendingOrFailed] = await models.$queryRaw`
    SELECT EXISTS(
      SELECT *
      FROM "Withdrawl"
      WHERE "userId" = ${id} AND "autoWithdraw"
      AND (status IS NULL
      OR (
        status <> 'CONFIRMED' AND
        now() < created_at + interval '1 hour' AND
        "msatsFeePaying" >= ${satsToMsats(maxFee)}
      ))
    )`

  if (pendingOrFailed.exists) return

  // get the wallets in order of priority
  const wallets = await models.wallet.findMany({
    where: { userId: user.id },
    orderBy: { priority: 'desc' }
  })

  for (const wallet of wallets) {
    try {
      const message = `autowithdrawal of ${numWithUnits(amount, { abbreviate: false, unitSingular: 'sat', unitPlural: 'sats' })}`
      if (wallet.type === 'LND') {
        await autowithdrawLND(
          { amount, maxFee },
          { models, me: user, lnd })
        await addWalletLog({
          wallet: 'walletLND',
          level: 'SUCCESS',
          message
        }, { me: user, models })
      } else if (wallet.type === 'LIGHTNING_ADDRESS') {
        await autowithdrawLNAddr(
          { amount, maxFee },
          { models, me: user, lnd })
        await addWalletLog({
          wallet: 'walletLightningAddress',
          level: 'SUCCESS',
          message
        }, { me: user, models })
      }

      return
    } catch (error) {
      console.error(error)
      // LND errors are in this shape: [code, type, { err: { code, details, metadata } }]
      const details = error[2]?.err?.details || error.message || error.toString?.()
      await addWalletLog({
        wallet: wallet.type === 'LND' ? 'walletLND' : 'walletLightningAddress',
        level: 'ERROR',
        message: 'autowithdrawal failed: ' + details
      })
    }
  }

  // none of the wallets worked
}

async function autowithdrawLNAddr (
  { amount, maxFee },
  { me, models, lnd, headers, autoWithdraw = false }) {
  if (!me) {
    throw new Error('me not specified')
  }

  const wallet = await models.wallet.findFirst({
    where: {
      userId: me.id,
      type: 'LIGHTNING_ADDRESS'
    },
    include: {
      walletLightningAddress: true
    }
  })

  if (!wallet || !wallet.walletLightningAddress) {
    throw new Error('no lightning address wallet found')
  }

  const { walletLightningAddress: { address } } = wallet
  return await sendToLnAddr(null, { addr: address, amount, maxFee }, { me, models, lnd, autoWithdraw: true })
}

async function autowithdrawLND ({ amount, maxFee }, { me, models, lnd }) {
  if (!me) {
    throw new Error('me not specified')
  }

  const wallet = await models.wallet.findFirst({
    where: {
      userId: me.id,
      type: 'LND'
    },
    include: {
      walletLND: true
    }
  })

  if (!wallet || !wallet.walletLND) {
    throw new Error('no lightning address wallet found')
  }

  const { walletLND: { cert, macaroon, socket } } = wallet
  const { lnd: lndOut } = await authenticatedLndGrpc({
    cert,
    macaroon,
    socket
  })

  const invoice = await createInvoice({
    description: me.hideInvoiceDesc ? undefined : 'autowithdraw to LND from SN',
    lnd: lndOut,
    tokens: amount,
    expires_at: datePivot(new Date(), { seconds: 360 })
  })

  return await createWithdrawal(null, { invoice: invoice.request, maxFee }, { me, models, lnd, autoWithdraw: true })
}
