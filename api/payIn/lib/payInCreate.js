import { assertBelowMaxPendingPayInBolt11s } from './assert'
import { isInvoiceable, isPessimistic } from './is'
import { getCostBreakdown, getPayInCustodialTokens } from './payInCustodialTokens'
import { payInPrismaCreate } from './payInPrisma'

export const PAY_IN_INCLUDE = {
  payInCustodialTokens: true,
  payOutBolt11: true,
  pessimisticEnv: true,
  user: true,
  payOutCustodialTokens: true
}

export async function payInCreate (tx, payInProspect, { me }) {
  const { mCostRemaining, mP2PCost, payInCustodialTokens } = await getPayInCosts(tx, payInProspect, { me })
  const payInState = await getPayInState(payInProspect, { mCostRemaining, mP2PCost })
  if (payInState !== 'PAID') {
    await assertBelowMaxPendingPayInBolt11s(tx, payInProspect.userId)
  }
  const payIn = await tx.payIn.create({
    data: {
      ...payInPrismaCreate({
        ...payInProspect,
        payInState,
        payInStateChangedAt: new Date(),
        payInCustodialTokens
      }),
      pessimisticEnv: {
        create: isPessimistic(payInProspect, { me }) ? { args: payInProspect } : undefined
      }
    },
    include: PAY_IN_INCLUDE
  })
  return { payIn, mCostRemaining }
}

async function getPayInCosts (tx, payIn, { me }) {
  const { mP2PCost, mCustodialCost } = getCostBreakdown(payIn)
  const payInCustodialTokens = await getPayInCustodialTokens(tx, mCustodialCost, payIn, { me })
  const mCustodialPaid = payInCustodialTokens.reduce((acc, token) => acc + token.mtokens, 0n)

  return {
    mP2PCost,
    mCustodialCost,
    mCustodialPaid,
    // TODO: how to deal with < 1000msats?
    mCostRemaining: mCustodialCost - mCustodialPaid + mP2PCost,
    payInCustodialTokens
  }
}

async function getPayInState (payIn, { mCostRemaining, mP2PCost }) {
  if (mCostRemaining > 0n) {
    if (!isInvoiceable(payIn)) {
      throw new Error('Insufficient funds')
    }
    if (mP2PCost > 0n) {
      return 'PENDING_INVOICE_WRAP'
    } else {
      return 'PENDING_INVOICE_CREATION'
    }
  }
  return 'PAID'
}
