import { isP2P, isPayableWithCredits, isProxyPayment } from './is'
import { USER_ID } from '@/lib/constants'

export async function getPayInCustodialTokens (tx, mCustodialCost, payIn, { me }) {
  const payInCustodialTokens = []

  if (!me || me.id === USER_ID.anon || mCustodialCost <= 0n) {
    return payInCustodialTokens
  }

  if (mCustodialCost % 1000n !== 0n) {
    throw new Error('mCustodialCost must be a multiple of 1000')
  }

  const mCreditPayable = isPayableWithCredits(payIn) ? mCustodialCost : 0n

  const [{ mcreditsSpent, mcreditsAfter, msatsSpent, msatsAfter }] = await tx.$queryRaw`
    -- Calculate optimal spending to maximize custodial usage, preferring to spend mcredits,
    -- while keeping any remainder as multiple of 1000 for invoice creation
    WITH user1 AS (
      SELECT
        id,
        msats,
        LEAST(mcredits, ${mCreditPayable}) as max_mcredits,
        (${mCustodialCost} - LEAST(mcredits, ${mCreditPayable})) % 1000 as max_mcredits_modulo_1000
      FROM users
      WHERE id = ${me.id}
      FOR UPDATE
    ),
    user_spending AS (
      SELECT
        id,
        (CASE
          -- Strategy 1: Can we pay everything custodially?
          WHEN max_mcredits + msats >= ${mCustodialCost} THEN
            ARRAY[max_mcredits, ${mCustodialCost} - max_mcredits]
          -- Strategy 2: Can we spend all mcredits and maximize msats spending, but leaving a remainder of a multiple of 1000?
          WHEN msats > 0 AND msats >= max_mcredits_modulo_1000 THEN
            ARRAY[max_mcredits,
                max_mcredits_modulo_1000 +
                  (GREATEST(0, msats - max_mcredits_modulo_1000 - max_mcredits) / 1000 * 1000)]
          -- Strategy 3: Spend multiples of 1000 only for both mcredits and msats
          ELSE
            ARRAY[(max_mcredits / 1000) * 1000, (msats / 1000) * 1000]
        END)::BIGINT[] AS spending
      FROM user1
    )
    UPDATE users
    SET
      mcredits = mcredits - user_spending.spending[1],
      msats = msats - user_spending.spending[2]
    FROM user_spending
    WHERE users.id = user_spending.id
    RETURNING
      user_spending.spending[1] as "mcreditsSpent",
      users.mcredits as "mcreditsAfter",
      user_spending.spending[2] as "msatsSpent",
      users.msats as "msatsAfter"`

  if (mcreditsSpent > 0n) {
    payInCustodialTokens.push({
      custodialTokenType: 'CREDITS',
      mtokens: mcreditsSpent,
      mtokensAfter: mcreditsAfter
    })
  }

  if (msatsSpent > 0n) {
    payInCustodialTokens.push({
      custodialTokenType: 'SATS',
      mtokens: msatsSpent,
      mtokensAfter: msatsAfter
    })
  }

  return payInCustodialTokens
}

function getP2PCost (payIn) {
  // proxy payments are only ever paid for with sats
  if (isProxyPayment(payIn)) {
    return payIn.mcost
  }
  // round this up to the nearest 1000msats
  // we don't want anyone to pay fractional sats via invoice
  if (isP2P(payIn)) {
    return Math.ceil(payIn.payOutBolt11?.msats ?? 0n / 1000n) * 1000n
  }
  return 0n
}

function getTotalCost (payIn) {
  const { beneficiaries = [] } = payIn
  return payIn.mcost + beneficiaries.reduce((acc, b) => acc + b.mcost, 0n)
}

export function getCostBreakdown (payIn) {
  const mP2PCost = getP2PCost(payIn)
  const mCustodialCost = getTotalCost(payIn) - mP2PCost

  return {
    mP2PCost,
    mCustodialCost
  }
}
