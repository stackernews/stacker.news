import { msatsToSats, satsToMsats } from '@/lib/format'
import { createWithdrawal } from '@/api/resolvers/wallet'
import createUserInvoice from '@/api/createInvoice'

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

  const { invoice, wallet } = await createUserInvoice({
    userId: id,
    msats: satsToMsats(amount),
    description: user.hideInvoiceDesc ? undefined : `autowithdraw from SN for ${user.name}`,
    expiry: 360
  }, { models })

  await createWithdrawal(null, { invoice, maxFee }, { me: user, models, lnd, walletId: wallet.id })
}
