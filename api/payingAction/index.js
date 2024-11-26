import { LND_PATHFINDING_TIMEOUT_MS, USER_ID } from '@/lib/constants'
import { msatsToSats, satsToMsats } from '@/lib/format'
import { toPositiveBigInt } from '@/lib/validate'
import { Prisma } from '@prisma/client'
import { parsePaymentRequest, payViaPaymentRequest } from 'ln-service'

// paying actions are completely distinct from paid actions
// and there's only one paying action: send
// ... still we want the api to at least be similar
export default async function performPayingAction ({ bolt11, maxFee, walletId }, { me, models, lnd }) {
  try {
    if (!me) {
      throw new Error('You must be logged in to perform this action')
    }

    const decoded = await parsePaymentRequest({ request: bolt11 })
    const cost = toPositiveBigInt(toPositiveBigInt(decoded.mtokens) + satsToMsats(maxFee))

    const withdrawal = await models.$transaction(async tx => {
      await tx.user.update({
        where: {
          id: me?.id ?? USER_ID.anon
        },
        data: { msats: { decrement: cost } }
      })

      return await tx.withdrawl.create({
        data: {
          hash: decoded.id,
          bolt11,
          msatsPaying: toPositiveBigInt(decoded.mtokens),
          msatsFeePaying: satsToMsats(maxFee),
          userId: me.id,
          walletId,
          autoWithdraw: !!walletId
        }
      })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted })

    payViaPaymentRequest({
      lnd,
      request: withdrawal.bolt11,
      max_fee: msatsToSats(withdrawal.msatsFeePaying),
      pathfinding_timeout: LND_PATHFINDING_TIMEOUT_MS
    }).catch(console.error)

    return withdrawal
  } catch (e) {
    if (e.message.includes('\\"users\\" violates check constraint \\"msats_positive\\"')) {
      throw new Error('insufficient funds')
    }
    console.error('performPayingAction failed', e)
    throw e
  } finally {
    console.groupEnd()
  }
}
