import { GraphQLError } from 'graphql'
import retry from 'async-retry'
import Prisma from '@prisma/client'
import { settleHodlInvoice } from 'ln-service'
import { createHmac } from './wallet'
import { msatsToSats } from '../../lib/format'

export default async function serialize (models, ...calls) {
  return await retry(async bail => {
    try {
      const [, ...result] = await models.$transaction(
        [models.$executeRaw`SELECT ASSERT_SERIALIZED()`, ...calls],
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
      return calls.length > 1 ? result : result[0]
    } catch (error) {
      console.log(error)
      if (error.message.includes('SN_INSUFFICIENT_FUNDS')) {
        bail(new GraphQLError('insufficient funds', { extensions: { code: 'BAD_INPUT' } }))
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
        bail(new Error('pending invoices must not cause balance to exceed 1m sats'))
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
    minTimeout: 100,
    factor: 1.1,
    retries: 5
  })
}

export async function serializeInvoicable (query, { models, lnd, hash, hmac, me, enforceFee }) {
  if (!me && !hash) {
    throw new Error('you must be logged in or pay')
  }

  let trx = [query]

  let invoice
  if (hash) {
    invoice = await checkInvoice(models, hash, hmac, enforceFee)
    trx = [
      models.$queryRaw`UPDATE users SET msats = msats + ${invoice.msatsReceived} WHERE id = ${invoice.user.id}`,
      query,
      models.invoice.update({ where: { hash: invoice.hash }, data: { confirmedAt: new Date() } })
    ]
  }

  const results = await serialize(models, ...trx)
  const result = trx.length > 1 ? results[1][0] : results[0]

  if (invoice?.isHeld) await settleHodlInvoice({ secret: invoice.preimage, lnd })

  return result
}

export async function checkInvoice (models, hash, hmac, fee) {
  if (!hash) {
    throw new GraphQLError('hash required', { extensions: { code: 'BAD_INPUT' } })
  }
  if (!hmac) {
    throw new GraphQLError('hmac required', { extensions: { code: 'BAD_INPUT' } })
  }
  const hmac2 = createHmac(hash)
  if (hmac !== hmac2) {
    throw new GraphQLError('bad hmac', { extensions: { code: 'FORBIDDEN' } })
  }

  const invoice = await models.invoice.findUnique({
    where: { hash },
    include: {
      user: true
    }
  })

  if (!invoice) {
    throw new GraphQLError('invoice not found', { extensions: { code: 'BAD_INPUT' } })
  }

  const expired = new Date(invoice.expiresAt) <= new Date()
  if (expired) {
    throw new GraphQLError('invoice expired', { extensions: { code: 'BAD_INPUT' } })
  }
  if (invoice.confirmedAt) {
    throw new GraphQLError('invoice already used', { extensions: { code: 'BAD_INPUT' } })
  }

  if (invoice.cancelled) {
    throw new GraphQLError('invoice was canceled', { extensions: { code: 'BAD_INPUT' } })
  }

  if (!invoice.msatsReceived) {
    throw new GraphQLError('invoice was not paid', { extensions: { code: 'BAD_INPUT' } })
  }
  if (fee && msatsToSats(invoice.msatsReceived) < fee) {
    throw new GraphQLError('invoice amount too low', { extensions: { code: 'BAD_INPUT' } })
  }

  return invoice
}
