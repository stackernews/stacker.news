import { LND_PATHFINDING_TIME_PREF_PPM, LND_PATHFINDING_TIMEOUT_MS } from '@/lib/constants'
import { msatsToSats, satsToMsats, toPositiveBigInt } from '@/lib/format'
import { Prisma } from '@prisma/client'
import { payInvoice, parseInvoice } from '@/lib/bolt'

// paying actions are completely distinct from paid actions
// and there's only one paying action: send
// ... still we want the api to at least be similar
export default async function performPayingAction ({ bolt11, maxFee, walletId }, { me, models, lnd }) {
  try {
    console.group('performPayingAction', `${bolt11.slice(0, 10)}...`, maxFee, walletId)

    if (!me) {
      throw new Error('You must be logged in to perform this action')
    }

    const decoded = await parseInvoice({ request: bolt11, lnd })
    const cost = toPositiveBigInt(toPositiveBigInt(decoded.mtokens) + satsToMsats(maxFee))

    console.log('cost', cost)

    const withdrawal = await models.$transaction(async tx => {
      await tx.user.update({
        where: {
          id: me.id
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

    payInvoice({
      lnd,
      request: withdrawal.bolt11,
      max_fee: msatsToSats(withdrawal.msatsFeePaying),
      pathfinding_timeout: LND_PATHFINDING_TIMEOUT_MS,
      confidence: LND_PATHFINDING_TIME_PREF_PPM
    }).catch(console.error)

    return withdrawal
  } catch (e) {
    if (e.message.includes('\\"users\\" violates check constraint \\"msats_positive\\"')) {
      throw new Error('insufficient funds')
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new Error('you cannot withdraw to the same invoice twice')
    }
    console.error('performPayingAction failed', e)
    throw e
  } finally {
    console.groupEnd()
  }
}
