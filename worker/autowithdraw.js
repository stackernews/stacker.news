import { msatsSatsFloor, msatsToSats, satsToMsats } from '@/lib/format'
import { createWithdrawal } from '@/api/resolvers/wallet'
import { createUserInvoice } from '@/wallets/server'

export async function autoWithdraw ({ data: { id }, models, lnd }) {
  const user = await models.user.findUnique({ where: { id } })
  if (
    user.autoWithdrawThreshold === null ||
    user.autoWithdrawMaxFeePercent === null ||
    user.autoWithdrawMaxFeeTotal === null) return

  const threshold = satsToMsats(user.autoWithdrawThreshold)
  const excess = Number(user.msats - threshold)

  // excess must be greater than 10% of threshold
  if (excess < Number(threshold) * 0.1) return

  // floor fee to nearest sat but still denominated in msats
  const maxFeeMsats = msatsSatsFloor(Math.max(
    Math.ceil(excess * (user.autoWithdrawMaxFeePercent / 100.0)),
    Number(satsToMsats(user.autoWithdrawMaxFeeTotal))
  ))
  // msats will be floored by createInvoice if it needs to be
  const msats = BigInt(excess) - maxFeeMsats

  // must be >= 1 sat
  if (msats < 1000n) return

  // check that
  // 1. the user doesn't have an autowithdraw pending
  // 2. we have not already attempted to autowithdraw this fee recently
  const [pendingOrFailed] = await models.$queryRaw`
    SELECT EXISTS(
      SELECT *
      FROM "Withdrawl"
      WHERE "userId" = ${id}
      AND "autoWithdraw"
      AND status IS DISTINCT FROM 'CONFIRMED'
      AND now() < created_at + interval '1 hour'
      AND "msatsFeePaying" >= ${maxFeeMsats}
    )`

  if (pendingOrFailed.exists) return

  for await (const { invoice, wallet, logger } of createUserInvoice(id, {
    msats,
    description: 'SN: autowithdrawal',
    expiry: 360
  }, { models })) {
    try {
      return await createWithdrawal(null,
        { invoice, maxFee: msatsToSats(maxFeeMsats) },
        { me: { id }, models, lnd, wallet, logger })
    } catch (err) {
      console.error('failed to create autowithdrawal:', err)
      logger?.error('incoming payment failed: ' + err.message, { bolt11: invoice })
    }
  }

  throw new Error('no wallet to receive available')
}
