import { msatsToSats, satsToMsats } from '@/lib/format'
import { createWithdrawal } from '@/api/resolvers/wallet'
import { createInvoice } from 'wallets/server'

export async function autoWithdraw ({ data: { id }, models, lnd }) {
  const user = await models.user.findUnique({ where: { id } })
  if (user.autoWithdrawThreshold === null || user.autoWithdrawMaxFeePercent === null) return

  const threshold = satsToMsats(user.autoWithdrawThreshold)
  const excess = Number(user.msats - threshold)

  // excess must be greater than 10% of threshold
  if (excess < Number(threshold) * 0.1) return

  const maxFeeMsats = Math.ceil(excess * (user.autoWithdrawMaxFeePercent / 100.0))
  const msats = excess - maxFeeMsats

  // must be >= 1 sat
  if (msats < 1000) return

  // maxFee is expected to be in sats, ie "msatsFeePaying" is always divisible by 1000
  const maxFee = msatsToSats(maxFeeMsats)

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

  const { invoice, wallet } = await createInvoice(id, { msats, description: 'SN: autowithdrawal', expiry: 360 }, { models })
  return await createWithdrawal(null,
    { invoice, maxFee },
    { me: { id }, models, lnd, walletId: wallet.id })
}
