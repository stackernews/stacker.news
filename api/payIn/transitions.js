const PAY_IN_TERMINAL_STATES = ['PAID', 'FAILED']

async function transitionPayIn (payInId, { fromStates, toState, transition }, { models }) {
  const payIn = await models.payIn.findUnique({ where: { id: payInId, payInState: { in: fromStates } } })
  if (!payIn) {
    throw new Error('PayIn not found')
  }

  if (PAY_IN_TERMINAL_STATES.includes(payIn.payInState)) {
    throw new Error('PayIn is in a terminal state')
  }

  if (!Array.isArray(fromStates)) {
    fromStates = [fromStates]
  }

  // TODO: retry on failure
  await models.$transaction(async tx => {
    const updatedPayIn = await tx.payIn.update({
      where: { id: payInId, payInState: { in: fromStates } },
      data: { payInState: toState },
      include: {
        payInCustodialTokens: true,
        payInBolt11: true,
        pessimisticEnv: true
      }
    })
    await transition(tx, updatedPayIn)
  })
}
export default transitionPayIn
