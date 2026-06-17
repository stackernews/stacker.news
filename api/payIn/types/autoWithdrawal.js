import { PAID_ACTION_PAYMENT_METHODS } from '@/lib/constants'
import { numWithUnits, msatsToSats, msatsSatsFloor, satsToMsats } from '@/lib/format'
import { payOutBolt11Prospect } from '../lib/payOutBolt11'

export const anonable = false

export const paymentMethods = [
  PAID_ACTION_PAYMENT_METHODS.REWARD_SATS
]

export class AutoWithdrawIneligibleError extends Error {
  constructor (message) {
    super(message)
    this.name = 'AutoWithdrawIneligibleError'
  }
}

// Single source of truth for the autowithdraw amount + eligibility arithmetic. Returns
// { threshold, excess, maxFeeMsats, msats } or null when the user is not eligible right now.
export function computeAutoWithdrawAmount (user) {
  if (
    user.autoWithdrawThreshold === null ||
    user.autoWithdrawMaxFeePercent === null ||
    user.autoWithdrawMaxFeeTotal === null) return null

  const threshold = satsToMsats(user.autoWithdrawThreshold)
  const excess = Number(user.msats - threshold)

  // excess must be greater than 10% of threshold
  if (excess < Number(threshold) * 0.1) return null

  // floor fee to nearest sat but still denominated in msats
  const maxFeeMsats = msatsSatsFloor(Math.max(
    Math.ceil(excess * (user.autoWithdrawMaxFeePercent / 100.0)),
    Number(satsToMsats(user.autoWithdrawMaxFeeTotal))
  ))
  // msats will be floored by createInvoice if it needs to be
  const msats = BigInt(excess) - maxFeeMsats

  // must be >= 100000 msats (100 sats)
  if (msats < 100000n) return null

  return { threshold, excess: BigInt(excess), maxFeeMsats, msats }
}

export async function getInitial (models, args, { me }) {
  const user = await models.user.findUnique({ where: { id: me?.id } })
  const amount = computeAutoWithdrawAmount(user)
  if (!amount) {
    throw new AutoWithdrawIneligibleError('autowithdraw no longer eligible')
  }
  const { msats, maxFeeMsats } = amount

  // TODO: description, expiry?
  const payOutBolt11 = await payOutBolt11Prospect(models, { msats, description: 'SN: auto-withdrawal' }, { userId: me?.id, payOutType: 'WITHDRAWAL' })
  return {
    payInType: 'AUTO_WITHDRAWAL',
    userId: me?.id,
    // some wallets truncate msats, so we need to update mcost to the actual amount received
    mcost: payOutBolt11.msats + maxFeeMsats,
    payOutBolt11,
    payOutCustodialTokens: [
      {
        payOutType: 'ROUTING_FEE',
        userId: null,
        mtokens: maxFeeMsats,
        custodialTokenType: 'SATS'
      }
    ]
  }
}

// Authoritative, transactional eligibility re-check. Runs inside begin()'s transaction with
// the user row locked FOR NO KEY UPDATE (obtainRowLevelLocks) and before the debit, so two
// concurrent autowithdraws serialize on the user row
export async function validateBeforeCreate (tx, payInProspect, args, { me }) {
  const user = await tx.user.findUnique({ where: { id: me.id } })
  const amount = computeAutoWithdrawAmount(user)
  if (!amount) {
    throw new AutoWithdrawIneligibleError('autowithdraw no longer eligible')
  }

  // the already-minted amount (+ routing fee) must still fit under the current excess
  const routingFeeMsats = payInProspect.payOutCustodialTokens
    .find(t => t.payOutType === 'ROUTING_FEE')?.mtokens ?? 0n
  const mintedMsats = payInProspect.payOutBolt11.msats + routingFeeMsats
  if (mintedMsats > amount.excess) {
    throw new AutoWithdrawIneligibleError('autowithdraw amount exceeds current excess')
  }

  // once-per-hour pending/failed-withdrawal guard, now read transactionally under the lock.
  // keyed on the actually-minted payOutBolt11.msats (post truncation), matching what gets persisted.
  const [pendingOrFailed] = await tx.$queryRaw`
    SELECT EXISTS(
      SELECT *
      FROM "PayOutBolt11"
      WHERE "userId" = ${me.id}
      AND status IS DISTINCT FROM 'CONFIRMED'
      AND "payOutType" = 'WITHDRAWAL'
      AND created_at > now() - interval '1 hour'
      AND "msats" >= ${satsToMsats(msatsToSats(payInProspect.payOutBolt11.msats))}
    )`
  if (pendingOrFailed.exists) {
    throw new AutoWithdrawIneligibleError('autowithdraw pending or recently attempted')
  }
}

export async function describe (models, payInId) {
  const payIn = await models.payIn.findUnique({ where: { id: payInId }, include: { payOutBolt11: true } })
  return `SN: auto-withdraw ${numWithUnits(msatsToSats(payIn.payOutBolt11.msats))}`
}
