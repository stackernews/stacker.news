import retry from 'async-retry'
import Prisma from '@prisma/client'
import { msatsToSats, numWithUnits } from '@/lib/format'
import { BALANCE_LIMIT_MSATS } from '@/lib/constants'
import { GqlInputError } from '@/lib/error'

export default async function serialize (trx, { models, lnd }) {
  // wrap first argument in array if not array already
  const isArray = Array.isArray(trx)
  if (!isArray) trx = [trx]

  // conditional queries can be added inline using && syntax
  // we filter any falsy value out here
  trx = trx.filter(q => !!q)

  const results = await retry(async bail => {
    try {
      const [, ...results] = await models.$transaction(
        [models.$executeRaw`SELECT ASSERT_SERIALIZED()`, ...trx],
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
      return results
    } catch (error) {
      console.log(error)
      // two cases where we get insufficient funds:
      // 1. plpgsql function raises
      // 2. constraint violation via a prisma call
      // XXX prisma does not provide a way to distinguish these cases so we
      // have to check the error message
      if (error.message.includes('SN_INSUFFICIENT_FUNDS') ||
        error.message.includes('\\"users\\" violates check constraint \\"msats_positive\\"')) {
        bail(new GqlInputError('insufficient funds'))
      }
      if (error.message.includes('SN_NOT_SERIALIZABLE')) {
        bail(new Error('wallet balance transaction is not serializable'))
      }
      if (error.message.includes('SN_CONFIRMED_WITHDRAWL_EXISTS')) {
        bail(new Error('withdrawal invoice already confirmed (to withdraw again create a new invoice)'))
      }
      if (error.message.includes('SN_PENDING_WITHDRAWL_EXISTS')) {
        bail(new Error('withdrawal invoice exists and is pending'))
      }
      if (error.message.includes('SN_INELIGIBLE')) {
        bail(new Error('user ineligible for gift'))
      }
      if (error.message.includes('SN_UNSUPPORTED')) {
        bail(new Error('unsupported action'))
      }
      if (error.message.includes('SN_DUPLICATE')) {
        bail(new Error('duplicate not allowed'))
      }
      if (error.message.includes('SN_REVOKED_OR_EXHAUSTED')) {
        bail(new Error('faucet has been revoked or is exhausted'))
      }
      if (error.message.includes('SN_INV_PENDING_LIMIT')) {
        bail(new Error('too many pending invoices'))
      }
      if (error.message.includes('SN_INV_EXCEED_BALANCE')) {
        bail(new Error(`pending invoices and withdrawals must not cause balance to exceed ${numWithUnits(msatsToSats(BALANCE_LIMIT_MSATS))}`))
      }
      if (error.message.includes('40001') || error.code === 'P2034') {
        throw new Error('wallet balance serialization failure - try again')
      }
      if (error.message.includes('23514') || ['P2002', 'P2003', 'P2004'].includes(error.code)) {
        bail(new Error('constraint failure'))
      }
      bail(error)
    }
  }, {
    minTimeout: 10,
    maxTimeout: 100,
    retries: 10
  })

  // if first argument was not an array, unwrap the result
  return isArray ? results : results[0]
}
