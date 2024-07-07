import { authenticatedLndGrpc, createInvoice as lndCreateInvoice, getIdentity, decodePaymentRequest } from 'ln-service'
import { msatsToSats, satsToMsats } from '@/lib/format'
// import { datePivot } from '@/lib/time'
import { createWithdrawal, /* sendToLnAddr, */ addWalletLog, SERVER_WALLET_DEFS } from '@/api/resolvers/wallet'
// import { createInvoice as createInvoiceCLN } from '@/lib/cln'

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
    orderBy: [
      { priority: 'desc' },
      // use id as tie breaker (older wallet first)
      { id: 'asc' }
    ]
  })

  for (const wallet of wallets) {
    try {
      for (const w of SERVER_WALLET_DEFS) {
        const { server: { walletType, walletField, createInvoice } } = w.default || w
        if (wallet.type === walletType) {
          await autowithdraw(
            { walletType, walletField, createInvoice },
            { amount, maxFee },
            { me: user, models, lnd }
          )
        }
      }

      // TODO: implement CLN autowithdrawal
      // ------
      // if (wallet.type === Wallet.CLN.type) {
      //   await autowithdrawCLN(
      //     { amount, maxFee },
      //     { models, me: user, lnd })
      // }

      return
    } catch (error) {
      console.error(error)
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
      lnd,
      lnService: {
        authenticatedLndGrpc,
        createInvoice: lndCreateInvoice,
        getIdentity,
        decodePaymentRequest
      }
    })

  return await createWithdrawal(null, { invoice: bolt11, maxFee }, { me, models, lnd, walletId: wallet.id })
}

// async function autowithdrawCLN ({ amount, maxFee }, { me, models, lnd }) {
//   if (!me) {
//     throw new Error('me not specified')
//   }
//
//   const wallet = await models.wallet.findFirst({
//     where: {
//       userId: me.id,
//       type: Wallet.CLN.type
//     },
//     include: {
//       walletCLN: true
//     }
//   })
//
//   if (!wallet || !wallet.walletCLN) {
//     throw new Error('no cln wallet found')
//   }
//
//   const { walletCLN: { cert, rune, socket } } = wallet
//
//   const inv = await createInvoiceCLN({
//     socket,
//     rune,
//     cert,
//     description: me.hideInvoiceDesc ? undefined : 'autowithdraw to CLN from SN',
//     msats: amount + 'sat',
//     expiry: 360
//   })
//
//   return await createWithdrawal(null, { invoice: inv.bolt11, maxFee }, { me, models, lnd, walletId: wallet.id })
// }
