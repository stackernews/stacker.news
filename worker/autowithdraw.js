import pay from '@/api/payIn'
import { AutoWithdrawIneligibleError, computeAutoWithdrawAmount } from '@/api/payIn/types/autoWithdrawal'

export async function autoWithdraw ({ data: { id }, models }) {
  // cheap best-effort pre-check so we don't mint a wasted invoice in the common
  // ineligible case.
  const user = await models.user.findUnique({ where: { id } })
  if (!computeAutoWithdrawAmount(user)) return

  try {
    await pay('AUTO_WITHDRAWAL', {}, { models, me: { id } })
  } catch (e) {
    // a concurrent autowithdraw or a balance drop can make us ineligible by the time we
    // hold the user-row lock; that's a benign no-op.
    if (e instanceof AutoWithdrawIneligibleError) return
    throw e
  }
}
