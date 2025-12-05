import {
  parsePaymentRequest
} from 'ln-service'
import crypto, { timingSafeEqual } from 'crypto'
import { validateSchema, withdrawlSchema, lnAddrSchema } from '@/lib/validate'
import assertGofacYourself from './ofac'
import assertApiKeyNotPermitted from './apiKey'
import { lnAddrOptions } from '@/lib/lnurl'
import { GqlAuthenticationError, GqlAuthorizationError, GqlInputError } from '@/lib/error'
import { getNodeSockets } from '../lnd'
import pay from '../payIn'
import { dropBolt11 } from '@/worker/autoDropBolt11'

export function createHmac (hash) {
  if (!hash) throw new GqlInputError('hash required to create hmac')
  const key = Buffer.from(process.env.INVOICE_HMAC_KEY, 'hex')
  return crypto.createHmac('sha256', key).update(Buffer.from(hash, 'hex')).digest('hex')
}

export function verifyHmac (hash, hmac) {
  if (!hash || !hmac) throw new GqlInputError('hash or hmac missing')
  const hmac2 = createHmac(hash)
  if (!timingSafeEqual(Buffer.from(hmac), Buffer.from(hmac2))) {
    throw new GqlAuthorizationError('bad hmac')
  }
  return true
}

const resolvers = {
  Query: {
    numBolt11s: async (parent, args, { me, models, lnd }) => {
      if (!me) {
        throw new GqlAuthenticationError()
      }

      return await models.payOutBolt11.count({
        where: {
          userId: me.id,
          hash: { not: null }
        }
      })
    },
    connectAddress: async (parent, args, { lnd }) => {
      return process.env.LND_CONNECT_ADDRESS
    }
  },
  Mutation: {
    createWithdrawl: createWithdrawal,
    sendToLnAddr,
    dropBolt11: async (parent, { hash }, { me, models, lnd }) => {
      if (!me) {
        throw new GqlAuthenticationError()
      }

      await dropBolt11({ userId: me.id, hash }, { models, lnd })
      return true
    },
    buyCredits: async (parent, { credits }, { me, models }) => {
      return await pay('BUY_CREDITS', { credits }, { models, me })
    }
  }
}

export default resolvers

export async function createWithdrawal (parent, { invoice, maxFee }, { me, models, lnd, headers, protocol, logger }) {
  assertApiKeyNotPermitted({ me })
  await validateSchema(withdrawlSchema, { invoice, maxFee })
  await assertGofacYourself({ models, headers })

  // remove 'lightning:' prefix if present
  invoice = invoice.replace(/^lightning:/, '')

  // decode invoice to get amount
  let decoded, sockets
  try {
    decoded = await parsePaymentRequest({ request: invoice })
  } catch (error) {
    console.log(error)
    throw new GqlInputError('could not decode invoice')
  }

  try {
    sockets = await getNodeSockets({ lnd, public_key: decoded.destination })
  } catch (error) {
    // likely not found if it's an unannounced channel, e.g. phoenix
    console.log(error)
  }

  if (sockets) {
    for (const { socket } of sockets) {
      const ip = socket.split(':')[0]
      await assertGofacYourself({ models, headers, ip })
    }
  }

  if (!decoded.mtokens || BigInt(decoded.mtokens) <= 0) {
    throw new GqlInputError('invoice must specify an amount')
  }

  if (decoded.mtokens > Number.MAX_SAFE_INTEGER) {
    throw new GqlInputError('invoice amount is too large')
  }

  // check if there's an invoice with same hash that's being proxied
  // we can't allow this because it creates two outgoing payments from our node
  // with the same hash
  const selfPayment = await models.payIn.findFirst({
    where: {
      payInBolt11: { hash: decoded.id },
      payOutBolt11: { isNot: null },
      payInType: { in: ['PROXY_PAYMENT', 'ZAP'] }
    }
  })
  if (selfPayment) {
    throw new GqlInputError('SN cannot pay an invoice that SN is proxying')
  }

  return await pay('WITHDRAWAL', { bolt11: invoice, maxFee, protocolId: protocol?.id }, { me, models })
}

async function sendToLnAddr (parent, { addr, amount, maxFee, comment, ...payer },
  { me, models, lnd, headers }) {
  if (!me) {
    throw new GqlAuthenticationError()
  }
  assertApiKeyNotPermitted({ me })

  const res = await fetchLnAddrInvoice({ addr, amount, maxFee, comment, ...payer },
    {
      me,
      models,
      lnd
    })

  // take pr and createWithdrawl
  return await createWithdrawal(parent, { invoice: res.pr, maxFee }, { me, models, lnd, headers })
}

async function fetchLnAddrInvoice (
  { addr, amount, maxFee, comment, ...payer },
  { me, models, lnd }) {
  const options = await lnAddrOptions(addr)
  await validateSchema(lnAddrSchema, { addr, amount, maxFee, comment, ...payer }, options)

  if (payer) {
    payer = {
      ...payer,
      identifier: payer.identifier ? `${me.name}@stacker.news` : undefined
    }
    payer = Object.fromEntries(
      Object.entries(payer).filter(([, value]) => !!value)
    )
  }

  const milliamount = 1000 * amount
  const callback = new URL(options.callback)
  callback.searchParams.append('amount', milliamount)

  if (comment?.length) {
    callback.searchParams.append('comment', comment)
  }

  let stringifiedPayerData = ''
  if (payer && Object.entries(payer).length) {
    stringifiedPayerData = JSON.stringify(payer)
    callback.searchParams.append('payerdata', stringifiedPayerData)
  }

  // call callback with amount and conditionally comment
  const res = await (await fetch(callback.toString())).json()
  if (res.status === 'ERROR') {
    throw new Error(res.reason)
  }

  // decode invoice
  try {
    const decoded = await parsePaymentRequest({ request: res.pr })
    if (!decoded.mtokens || BigInt(decoded.mtokens) !== BigInt(milliamount)) {
      throw new Error('invoice has incorrect amount')
    }
  } catch (e) {
    console.log(e)
    throw e
  }

  return res
}
