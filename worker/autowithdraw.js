import { msatsToSats, satsToMsats } from '@/lib/format'
import { createWithdrawal, addWalletLog } from '@/api/resolvers/wallet'
import walletDefs from 'wallets/server'

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
    where: { userId: user.id, enabled: true },
    orderBy: [
      { priority: 'asc' },
      // use id as tie breaker (older wallet first)
      { id: 'asc' }
    ]
  })

  for (const wallet of wallets) {
    const w = walletDefs.find(w => w.walletType === wallet.type)
    try {
      const { walletType, walletField, createInvoice } = w
      return await autowithdraw(
        { walletType, walletField, createInvoice },
        { amount, maxFee },
        { me: user, models, lnd }
      )
    } catch (error) {
      console.error(error)

      // TODO: I think this is a bug, `walletCreateInvoice` in `autowithdraw` should parse the error

      // LND errors are in this shape: [code, type, { err: { code, details, metadata } }]
      const details = error[2]?.err?.details || error.message || error.toString?.()
      await addWalletLog({
        wallet,
        level: 'ERROR',
        message: 'autowithdrawal failed: ' + details
      }, { me: user, models })
    }
  }

  // none of the wallets worked
}

async function autowithdraw (
  { walletType, walletField, createInvoice: walletCreateInvoice },
  { amount, maxFee },
  { me, models, lnd }) {
  if (!me) {
    throw new Error('me not specified')
  }

  const wallet = await models.wallet.findFirst({
    where: {
      userId: me.id,
      type: walletType
    },
    include: {
      [walletField]: true
    }
  })

  if (!wallet || !wallet[walletField]) {
    throw new Error(`no ${walletType} wallet found`)
  }

  const bolt11 = await walletCreateInvoice(
    { amount, maxFee },
    wallet[walletField],
    {
      me,
      models,
      lnd
    })

  return await createWithdrawal(null, { invoice: bolt11, maxFee }, { me, models, lnd, walletId: wallet.id })
}
