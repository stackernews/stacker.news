import { assertBelowMaxPendingPayInBolt11s } from './assert'
import { isInvoiceable, isPessimistic, isWithdrawal } from './is'
import { getCostBreakdown, getPayInCustodialTokens } from './payInCustodialTokens'
import { payInPrismaCreate } from './payInPrisma'

export const PAY_IN_INCLUDE = {
  payInCustodialTokens: true,
  payOutBolt11: true,
  payInBolt11: true,
  pessimisticEnv: true,
  user: true,
  payOutCustodialTokens: true
}

// TODO: before we create, validate the payIn such that
// 1. the payIn amounts are enough to cover the payOuts
// ... and other invariants are met
export async function payInCreate (tx, payInProspect, payInArgs, { me }) {
  const { mCostRemaining, mP2PCost, payInCustodialTokens } = await getPayInCosts(tx, payInProspect, { me })
  const payInState = await getPayInState(payInProspect, { mCostRemaining, mP2PCost })
  if (!isWithdrawal(payInProspect) && payInState !== 'PAID') {
    await assertBelowMaxPendingPayInBolt11s(tx, payInProspect.userId)
  }
  console.log('payInProspect', payInProspect)
  const payIn = await tx.payIn.create({
    data: {
      ...payInPrismaCreate({
        ...payInProspect,
        payInState,
        payInStateChangedAt: new Date(),
        payInCustodialTokens
      }),
      pessimisticEnv: {
        create: isPessimistic(payInProspect, { me }) && !isWithdrawal(payInProspect) && payInState !== 'PAID' ? { args: payInArgs } : undefined
      }
    },
    include: PAY_IN_INCLUDE
  })
  console.log('payIn', payIn)
  return { payIn, mCostRemaining }
}

async function getPayInCosts (tx, payIn, { me }) {
  const { mP2PCost, mCustodialCost } = getCostBreakdown(payIn)
  const payInCustodialTokens = await getPayInCustodialTokens(tx, mCustodialCost, payIn, { me })
  console.log('payInCustodialTokens', payInCustodialTokens)
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

  if (isWithdrawal(payIn)) {
    return 'PENDING_WITHDRAWAL'
  }

  return 'PAID'
}
