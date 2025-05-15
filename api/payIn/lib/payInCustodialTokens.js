import { isP2P, isPayableWithCredits } from './is'
import { USER_ID } from '@/lib/constants'

export async function getPayInCustodialTokens (tx, mCustodialCost, payIn, { me }) {
  if (!me || me.id === USER_ID.anon || mCustodialCost <= 0n) {
    return []
  }

  const payInAssets = []
  if (isPayableWithCredits(payIn)) {
    const { mcreditsSpent, mcreditsBefore } = await tx.$queryRaw`
      UPDATE users
      SET mcredits = CASE
        WHEN mcredits >= ${mCustodialCost} THEN mcredits - ${mCustodialCost}
        ELSE mcredits - ((mcredits / 1000) * 1000)
      END
      FROM (SELECT id, mcredits FROM users WHERE id = ${me.id} FOR UPDATE) before
      WHERE users.id = before.id
      RETURNING mcredits - before.mcredits as mcreditsSpent, before.mcredits as mcreditsBefore`
    if (mcreditsSpent > 0n) {
      payInAssets.push({
        payInAssetType: 'CREDITS',
        masset: mcreditsSpent,
        massetBefore: mcreditsBefore
      })
    }
    mCustodialCost -= mcreditsSpent
  }

  const { msatsSpent, msatsBefore } = await tx.$queryRaw`
    UPDATE users
    SET msats = CASE
      WHEN msats >= ${mCustodialCost} THEN msats - ${mCustodialCost}
      ELSE msats - ((msats / 1000) * 1000)
    END
    FROM (SELECT id, msats FROM users WHERE id = ${me.id} FOR UPDATE) before
    WHERE users.id = before.id
    RETURNING msats - before.msats as msatsSpent, before.msats as msatsBefore`
  if (msatsSpent > 0n) {
    payInAssets.push({
      payInAssetType: 'SATS',
      masset: msatsSpent,
      massetBefore: msatsBefore
    })
  }

  return payInAssets
}

export async function getCostBreakdown (payIn) {
  const { payOutBolt11, beneficiaries } = payIn
  const mP2PCost = isP2P(payIn) ? (payOutBolt11?.msats ?? 0n) : 0n
  const mCustodialCost = payIn.mcost + beneficiaries.reduce((acc, b) => acc + b.mcost, 0n) - mP2PCost

  return {
    mP2PCost,
    mCustodialCost
  }
}
