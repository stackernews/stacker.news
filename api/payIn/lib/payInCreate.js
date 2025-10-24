import { assertBelowMaxPendingPayInBolt11s, assertMcostRemaining, assertBalancedPayInAndPayOuts } from './assert'
import { isInvoiceable, isPessimistic, isWithdrawal } from './is'
import { getCostBreakdown, getPayInCustodialTokens } from './payInCustodialTokens'
import { payInPrismaCreate } from './payInPrisma'

export const PAY_IN_INCLUDE = {
  payInCustodialTokens: true,
  payOutBolt11: true,
  payInBolt11: true,
  pessimisticEnv: true,
  user: true,
  payOutCustodialTokens: true,
  beneficiaries: true
}

// XXX consider adding more asserts
export async function payInCreate (tx, payInProspect, payInArgs, { me }) {
  const { mCostRemaining, mP2PCost, payInCustodialTokens } = await getPayInCosts(tx, payInProspect, { me })
  const payInState = await getPayInState(payInProspect, { mCostRemaining, mP2PCost })
  const payOutCustodialTokens = payInProspect.payOutCustodialTokens
  const fullProspect = { ...payInProspect, payInState, payInCustodialTokens, payOutCustodialTokens }

  assertMcostRemaining(mCostRemaining)
  assertBalancedPayInAndPayOuts(fullProspect)
  await assertBelowMaxPendingPayInBolt11s(tx, fullProspect)

  const payIn = await tx.payIn.create({
    data: {
      ...payInPrismaCreate(fullProspect),
      pessimisticEnv: {
        create: isPessimistic(fullProspect, { me }) ? { args: payInArgs } : undefined
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

  if (isWithdrawal(payIn)) {
    return 'PENDING_WITHDRAWAL'
  }

  return 'PAID'
}
