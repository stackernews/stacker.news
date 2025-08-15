import { isP2P, isPayableWithCredits, isProxyPayment } from './is'
import { USER_ID } from '@/lib/constants'

export async function getPayInCustodialTokens (tx, mCustodialCost, payIn, { me }) {
  const payInCustodialTokens = []

  if (!me || me.id === USER_ID.anon || mCustodialCost <= 0n) {
    return payInCustodialTokens
  }

  // we always want to return mcreditsBefore, even if we don't spend any credits
  const mCreditPayable = isPayableWithCredits(payIn) ? mCustodialCost : 0n
  const [{ mcreditsSpent, mcreditsBefore }] = await tx.$queryRaw`
      UPDATE users
      SET mcredits = CASE
        WHEN users.mcredits >= ${mCreditPayable} THEN users.mcredits - ${mCreditPayable}
        ELSE users.mcredits - ((users.mcredits / 1000) * 1000)
      END
      FROM (SELECT id, mcredits FROM users WHERE id = ${me.id} FOR UPDATE) before
      WHERE users.id = before.id
      RETURNING before.mcredits - users.mcredits as "mcreditsSpent", before.mcredits as "mcreditsBefore"`
  if (mcreditsSpent > 0n) {
    payInCustodialTokens.push({
      custodialTokenType: 'CREDITS',
      mtokens: mcreditsSpent,
      mtokensBefore: mcreditsBefore
    })
  }
  mCustodialCost -= mcreditsSpent

  const [{ msatsSpent, msatsBefore }] = await tx.$queryRaw`
    UPDATE users
    SET msats = CASE
      WHEN users.msats >= ${mCustodialCost} THEN users.msats - ${mCustodialCost}
      ELSE users.msats - ((users.msats / 1000) * 1000)
    END
    FROM (SELECT id, msats FROM users WHERE id = ${me.id} FOR UPDATE) before
    WHERE users.id = before.id
    RETURNING before.msats - users.msats as "msatsSpent", before.msats as "msatsBefore"`
  if (msatsSpent > 0n) {
    payInCustodialTokens.push({
      custodialTokenType: 'SATS',
      mtokens: msatsSpent,
      mtokensBefore: msatsBefore
    })
  }

  return payInCustodialTokens
}

function getP2PCost (payIn) {
  // proxy payments are only ever paid for with sats
  if (isProxyPayment(payIn)) {
    return payIn.mcost
  }
  if (isP2P(payIn)) {
    return payIn.payOutBolt11?.msats ?? 0n
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
