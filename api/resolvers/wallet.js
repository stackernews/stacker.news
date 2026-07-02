import {
  parsePaymentRequest
} from 'ln-service'
import crypto, { timingSafeEqual } from 'crypto'
import { validateSchema, withdrawlSchema, walletInvoiceSchema } from '@/lib/validate'
import { satsToMsats } from '@/lib/format'
import assertGofacYourself from './ofac'
import assertApiKeyNotPermitted from './apiKey'
import { fetchLnAddrInvoice } from '@/lib/lnurl'
import { normalizeBolt11PaymentRequest } from '@/lib/bolt11'
import { GqlAuthenticationError, GqlAuthorizationError, GqlInputError } from '@/lib/error'
import { parseWalletId } from '@/wallets/server/resolvers/util'
import { getNodeSockets } from '../lnd'
import pay from '../payIn'
import { dropBolt11 } from '@/worker/autoDropBolt11'
import { createBolt11FromWalletProtocols } from '@/wallets/server/receive'
import {
  createExternalReceiveTransaction,
  createExternalSendTransaction,
  externalTransactionInclude,
  pokeExternalTransactionCheck,
  updateExternalTransaction as updateExternalTransactionRow
} from '@/wallets/server/external-transactions'

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
    },
    externalTransaction: async (parent, { id }, { me, models }) => {
      if (!me) {
        throw new GqlAuthenticationError()
      }

      const transaction = await models.externalTransaction.findFirst({
        where: {
          id: Number(id),
          userId: me.id
        },
        include: externalTransactionInclude()
      })
      // reading a live receive is the demand signal for its next provider check
      await pokeExternalTransactionCheck(models, transaction)
      return transaction
    }
  },
  Mutation: {
    createWithdrawl: createWithdrawal,
    createWalletInvoice,
    createExternalTransaction: async (parent, { input }, { me, models }) => {
      if (!me) {
        throw new GqlAuthenticationError()
      }
      assertApiKeyNotPermitted({ me })

      return await createExternalSendTransaction(models, {
        ...input,
        direction: 'SEND',
        userId: me.id,
        walletId: parseWalletId(input.walletId)
      })
    },
    updateExternalTransaction: async (parent, { input }, { me, models }) => {
      if (!me) {
        throw new GqlAuthenticationError()
      }
      assertApiKeyNotPermitted({ me })

      return await updateExternalTransactionRow(models, {
        ...input,
        userId: me.id
      })
    },
    sendToLnAddr,
    dropBolt11: async (parent, { hash }, { me, models, lnd }) => {
      if (!me) {
        throw new GqlAuthenticationError()
      }

      await dropBolt11({ userId: me.id, hash }, { models, lnd })
      return true
    },
    buyCredits: async (parent, { credits, sendProtocolId }, { me, models }) => {
      return await pay('BUY_CREDITS', { credits }, { models, me, sendProtocolId })
    }
  }
}

export default resolvers

export async function createWithdrawal (parent, { invoice, maxFee }, { me, models, lnd, headers, protocol, logger }) {
  assertApiKeyNotPermitted({ me })
  await validateSchema(withdrawlSchema, { invoice, maxFee })
  await assertGofacYourself({ models, headers })

  invoice = normalizeBolt11PaymentRequest(invoice)

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

async function createWalletInvoice (parent, { walletId, amount, description }, { me, models }) {
  if (!me) {
    throw new GqlAuthenticationError()
  }
  assertApiKeyNotPermitted({ me })

  const walletIdNumber = parseWalletId(walletId)

  const validated = await validateSchema(walletInvoiceSchema, { amount, description })

  const sats = Number(validated.amount)

  const protocols = await models.walletProtocol.findMany({
    where: {
      walletId: walletIdNumber,
      send: false,
      enabled: true,
      wallet: {
        userId: me.id
      }
    },
    orderBy: {
      id: 'asc'
    }
  })

  if (protocols.length === 0) {
    throw new GqlInputError('wallet cannot receive')
  }

  const walletProtocols = protocols.map(protocol => ({
    ...protocol,
    userId: me.id
  }))

  const invoices = createBolt11FromWalletProtocols(
    walletProtocols,
    {
      msats: satsToMsats(sats),
      description: validated.description
    },
    { models, limitPending: false }
  )
  const { value } = await invoices.next()

  if (!value) {
    throw new GqlInputError('wallet could not create a receive invoice')
  }

  const transaction = await createExternalReceiveTransaction(models, {
    userId: me.id,
    walletId: walletIdNumber,
    protocolId: value.protocol.id,
    direction: 'RECEIVE',
    bolt11: value.bolt11,
    verificationContext: value.verificationContext
  })

  await value.logger.ok('saved receive invoice to activity', {
    externalTransactionId: transaction.id,
    bolt11: value.bolt11
  })

  return { bolt11: value.bolt11, transaction }
}

async function sendToLnAddr (parent, { addr, amount, maxFee, comment, ...payer },
  { me, models, lnd, headers }) {
  if (!me) {
    throw new GqlAuthenticationError()
  }
  assertApiKeyNotPermitted({ me })
  if (maxFee < 0) {
    throw new GqlInputError('max fee must be at least 0')
  }

  const res = await fetchLnAddrInvoice(
    { addr, amount, comment, ...payer },
    { me, validateInvoice: validateLnAddrInvoice }
  )

  // take pr and createWithdrawl
  return await createWithdrawal(parent, { invoice: res.pr, maxFee }, { me, models, lnd, headers })
}

async function validateLnAddrInvoice (bolt11, expectedMsats) {
  let decoded
  try {
    decoded = await parsePaymentRequest({ request: bolt11 })
  } catch (err) {
    throw new GqlInputError('could not decode invoice')
  }

  if (!decoded.mtokens || BigInt(decoded.mtokens) !== BigInt(expectedMsats)) {
    throw new GqlInputError('invoice has incorrect amount')
  }
}
