import { USER_ID } from '@/lib/constants'
import { NoReceiveWalletError, payOutBolt11Replacement } from './payOutBolt11'
import { payOutCustodialTokenFromBolt11 } from './payOutCustodialTokens'
import { isP2POnly } from './is'

export async function payInReplacePayOuts (models, payInFailedInitial) {
  if (!payInFailedInitial.payOutBolt11) {
    return payInFailedInitial
  }

  const payInFailed = { ...payInFailedInitial }
  try {
    payInFailed.payOutBolt11 = await payOutBolt11Replacement(models, payInFailed.genesisId ?? payInFailed.id, payInFailed.payOutBolt11)
    // it's possible that the replacement payOutBolt11 is less than the original
    // due to msats truncation ... so we need to add the difference to the rewards pool
    if (payInFailed.payOutBolt11.msats !== payInFailedInitial.payOutBolt11.msats) {
      if (payInFailed.payOutBolt11.msats < payInFailedInitial.payOutBolt11.msats) {
        const excessMsats = payInFailedInitial.payOutBolt11.msats - payInFailed.payOutBolt11.msats
        payInFailed.payOutCustodialTokens.push({
          payOutType: 'REWARDS_POOL',
          userId: USER_ID.rewards,
          custodialTokenType: 'SATS',
          mtokens: excessMsats
        })
      } else {
        throw new NoReceiveWalletError('payOutBolt11Replacement returned more msats than the original')
      }
    }
  } catch (e) {
    console.error('payOutBolt11Replacement failed', e)
    if (!(e instanceof NoReceiveWalletError)) {
      throw e
    }
    // p2p-only payments (bounty, proxy) never fall back to custodial credits
    if (isP2POnly(payInFailedInitial)) {
      throw e
    }
    // if we can no longer produce a payOutBolt11, we fallback to custodial tokens
    payInFailed.payOutCustodialTokens.push(payOutCustodialTokenFromBolt11(payInFailed.payOutBolt11))
    // convert the routing fee to another rewards pool output
    const routingFee = payInFailed.payOutCustodialTokens.find(t => t.payOutType === 'ROUTING_FEE')
    if (routingFee) {
      routingFee.payOutType = 'REWARDS_POOL'
      routingFee.userId = USER_ID.rewards
    }
    payInFailed.payOutBolt11 = null
  }
  return payInFailed
}
