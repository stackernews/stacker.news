const MAX_PENDING_PAY_IN_BOLT_11_PER_USER = 100

export async function assertBelowMaxPendingPayInBolt11s (models, payIn) {
  if (['PAID', 'PENDING_WITHDRAWAL'].includes(payIn.payInState)) {
    return
  }

  const pendingBolt11s = await models.payInBolt11.count({
    where: {
      userId: payIn.userId,
      confirmedAt: null,
      cancelledAt: null
    }
  })

  if (pendingBolt11s >= MAX_PENDING_PAY_IN_BOLT_11_PER_USER) {
    throw new Error('You have too many pending paid actions, cancel some or wait for them to expire')
  }
}

export function assertMcostRemaining (mcost) {
  if (mcost % 1000n !== 0n) {
    throw new Error('mcost must be a multiple of 1000')
  }
}

export function assertBalancedPayInAndPayOuts (payIn) {
  // pay outs equal to mcost
  // pay ins equal to mcost if paid
  // pay ins less than mcost if not paid
  const payOutsMcost = payIn.payOutCustodialTokens?.reduce((acc, token) => acc + token.mtokens, 0n) ?? 0n + (payIn.payOutBolt11?.msats ?? 0n) +
    (payIn.beneficiaries?.reduce((acc, beneficiary) => acc + beneficiary.mcost, 0n) ?? 0n)
  const payInsMcost = payIn.payInCustodialTokens?.reduce((acc, token) => acc + token.mtokens, 0n) ?? 0n
  if (payOutsMcost !== payIn.mcost) {
    throw new Error('pay outs must equal mcost')
  }
  if (payIn.payInState === 'PAID' && payInsMcost !== payIn.mcost) {
    throw new Error('pay ins must equal mcost if paid')
  }
  if (payIn.payInState !== 'PAID' && payInsMcost >= payIn.mcost) {
    throw new Error('pay ins must be less than mcost if not paid')
  }

  payIn.beneficiaries?.forEach(beneficiary => {
    const payOutsMcost = beneficiary.payOutCustodialTokens.reduce((acc, token) => acc + token.mtokens, 0n) + (beneficiary.payOutBolt11?.msats ?? 0n)
    if (payOutsMcost !== beneficiary.mcost) {
      throw new Error('beneficiary pay outs must equal their mcost')
    }
  })
}
