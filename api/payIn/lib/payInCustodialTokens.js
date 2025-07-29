import { isP2P, isPayableWithCredits } from './is'
import { USER_ID } from '@/lib/constants'

export async function getPayInCustodialTokens (tx, mCustodialCost, payIn, { me }) {
  if (!me || me.id === USER_ID.anon || mCustodialCost <= 0n) {
    return []
  }

  const payInCustodialTokens = []

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
      mtokens: mcreditsSpent
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
      mtokens: msatsSpent
    })
  }

  return { payInCustodialTokens, mcreditsBefore, msatsBefore }
}

export function getCostBreakdown (payIn) {
  const { payOutBolt11, beneficiaries = [] } = payIn
  const mP2PCost = isP2P(payIn) ? (payOutBolt11?.msats ?? 0n) : 0n
  const mCustodialCost = payIn.mcost + beneficiaries.reduce((acc, b) => acc + b.mcost, 0n) - mP2PCost

  return {
    mP2PCost,
    mCustodialCost
  }
}
