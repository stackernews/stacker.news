const MAX_PENDING_PAY_IN_BOLT_11_PER_USER = 100

export async function assertBelowMaxPendingPayInBolt11s (models, userId) {
  const pendingBolt11s = await models.payInBolt11.count({
    where: {
      userId,
      confirmedAt: null,
      cancelledAt: null
    }
  })

  if (pendingBolt11s >= MAX_PENDING_PAY_IN_BOLT_11_PER_USER) {
    throw new Error('You have too many pending paid actions, cancel some or wait for them to expire')
  }
}
