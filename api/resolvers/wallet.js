import { createHodlInvoice, createInvoice, decodePaymentRequest, payViaPaymentRequest, cancelHodlInvoice } from 'ln-service'
import { GraphQLError } from 'graphql'
import crypto from 'crypto'
import serialize from './serial'
import { lnurlPayDescriptionHash } from '../../lib/lnurl'
import { msatsToSats } from '../../lib/format'
import { amountSchema, lnAddrSchema, ssValidate, withdrawlSchema } from '../../lib/validate'
import { ANON_BALANCE_LIMIT_MSATS, ANON_INV_PENDING_LIMIT, ANON_USER_ID, BALANCE_LIMIT_MSATS, INV_PENDING_LIMIT } from '../../lib/constants'
import { datePivot } from '../../lib/time'
import { walletHistory, Fact } from './wallet-common'

export async function getInvoice (parent, { id }, { me, models, lnd }) {
  const inv = await models.invoice.findUnique({
    where: {
      id: Number(id)
    },
    include: {
      user: true
    }
  })

  if (!inv) {
    throw new GraphQLError('invoice not found', { extensions: { code: 'BAD_INPUT' } })
  }

  if (inv.user.id === ANON_USER_ID) {
    return inv
  }
  if (!me) {
    throw new GraphQLError('you must be logged in', { extensions: { code: 'FORBIDDEN' } })
  }
  if (inv.user.id !== me.id) {
    throw new GraphQLError('not ur invoice', { extensions: { code: 'FORBIDDEN' } })
  }

  try {
    inv.nostr = JSON.parse(inv.desc)
  } catch (err) {
  }

  return inv
}

export function createHmac (hash) {
  const key = Buffer.from(process.env.INVOICE_HMAC_KEY, 'hex')
  return crypto.createHmac('sha256', key).update(Buffer.from(hash, 'hex')).digest('hex')
}

export default {
  Query: {
    invoice: getInvoice,
    withdrawl: async (parent, { id }, { me, models, lnd }) => {
      if (!me) {
        throw new GraphQLError('you must be logged in', { extensions: { code: 'FORBIDDEN' } })
      }

      const wdrwl = await models.withdrawl.findUnique({
        where: {
          id: Number(id)
        },
        include: {
          user: true
        }
      })

      if (wdrwl.user.id !== me.id) {
        throw new GraphQLError('not ur withdrawal', { extensions: { code: 'FORBIDDEN' } })
      }

      return wdrwl
    },
    connectAddress: async (parent, args, { lnd }) => {
      return process.env.LND_CONNECT_ADDRESS
    },
    walletHistory
  },

  Mutation: {
    createInvoice: async (parent, { amount, hodlInvoice = false, expireSecs = 3600 }, { me, models, lnd }) => {
      await ssValidate(amountSchema, { amount })

      let expirePivot = { seconds: expireSecs }
      let invLimit = INV_PENDING_LIMIT
      let balanceLimit = BALANCE_LIMIT_MSATS
      let id = me?.id
      if (!me) {
        expirePivot = { seconds: Math.min(expireSecs, 180) }
        invLimit = ANON_INV_PENDING_LIMIT
        balanceLimit = ANON_BALANCE_LIMIT_MSATS
        id = ANON_USER_ID
      }

      const user = await models.user.findUnique({ where: { id } })

      const expiresAt = datePivot(new Date(), expirePivot)
      const description = `Funding @${user.name} on stacker.news`
      try {
        const invoice = await (hodlInvoice ? createHodlInvoice : createInvoice)({
          description: user.hideInvoiceDesc ? undefined : description,
          lnd,
          tokens: amount,
          expires_at: expiresAt
        })

        const [inv] = await serialize(models,
          models.$queryRaw`SELECT * FROM create_invoice(${invoice.id}, ${invoice.request},
            ${expiresAt}::timestamp, ${amount * 1000}, ${user.id}::INTEGER, ${description},
            ${invLimit}::INTEGER, ${balanceLimit})`)

        if (hodlInvoice) await models.invoice.update({ where: { hash: invoice.id }, data: { preimage: invoice.secret } })

        // the HMAC is only returned during invoice creation
        // this makes sure that only the person who created this invoice
        // has access to the HMAC
        const hmac = createHmac(inv.hash)

        return { ...inv, hmac }
      } catch (error) {
        console.log(error)
        throw error
      }
    },
    createWithdrawl: createWithdrawal,
    sendToLnAddr: async (parent, { addr, amount, maxFee }, { me, models, lnd }) => {
      await ssValidate(lnAddrSchema, { addr, amount, maxFee })

      const [name, domain] = addr.split('@')
      let req
      try {
        req = await fetch(`https://${domain}/.well-known/lnurlp/${name}`)
      } catch (e) {
        throw new Error(`error initiating protocol with https://${domain}`)
      }

      const res1 = await req.json()
      if (res1.status === 'ERROR') {
        throw new Error(res1.reason)
      }

      const milliamount = amount * 1000
      // check that amount is within min and max sendable
      if (milliamount < res1.minSendable || milliamount > res1.maxSendable) {
        throw new GraphQLError(`amount must be >= ${res1.minSendable / 1000} and <= ${res1.maxSendable / 1000}`, { extensions: { code: 'BAD_INPUT' } })
      }

      const callback = new URL(res1.callback)
      callback.searchParams.append('amount', milliamount)

      // call callback with amount
      const res2 = await (await fetch(callback.toString())).json()
      if (res2.status === 'ERROR') {
        throw new Error(res2.reason)
      }

      // decode invoice
      let decoded
      try {
        decoded = await decodePaymentRequest({ lnd, request: res2.pr })
      } catch (error) {
        console.log(error)
        throw new Error('could not decode invoice')
      }

      if (decoded.description_hash !== lnurlPayDescriptionHash(res1.metadata)) {
        throw new Error('description hash does not match')
      }

      // take pr and createWithdrawl
      return await createWithdrawal(parent, { invoice: res2.pr, maxFee }, { me, models, lnd })
    },
    cancelInvoice: async (parent, { hash, hmac }, { models, lnd }) => {
      const hmac2 = createHmac(hash)
      if (hmac !== hmac2) {
        throw new GraphQLError('bad hmac', { extensions: { code: 'FORBIDDEN' } })
      }
      await cancelHodlInvoice({ id: hash, lnd })
      const inv = await serialize(models,
        models.invoice.update({
          where: {
            hash
          },
          data: {
            cancelled: true
          }
        }))
      return inv
    }
  },

  Withdrawl: {
    satsPaying: w => msatsToSats(w.msatsPaying),
    satsPaid: w => msatsToSats(w.msatsPaid),
    satsFeePaying: w => msatsToSats(w.msatsFeePaying),
    satsFeePaid: w => msatsToSats(w.msatsFeePaid)
  },

  Invoice: {
    satsReceived: i => msatsToSats(i.msatsReceived),
    satsRequested: i => msatsToSats(i.msatsRequested)
  },

  Fact
}

async function createWithdrawal (parent, { invoice, maxFee }, { me, models, lnd }) {
  await ssValidate(withdrawlSchema, { invoice, maxFee })

  // remove 'lightning:' prefix if present
  invoice = invoice.replace(/^lightning:/, '')

  // decode invoice to get amount
  let decoded
  try {
    decoded = await decodePaymentRequest({ lnd, request: invoice })
  } catch (error) {
    console.log(error)
    throw new GraphQLError('could not decode invoice', { extensions: { code: 'BAD_INPUT' } })
  }

  if (!decoded.mtokens || BigInt(decoded.mtokens) <= 0) {
    throw new GraphQLError('your invoice must specify an amount', { extensions: { code: 'BAD_INPUT' } })
  }

  const msatsFee = Number(maxFee) * 1000

  const user = await models.user.findUnique({ where: { id: me.id } })

  // create withdrawl transactionally (id, bolt11, amount, fee)
  const [withdrawl] = await serialize(models,
    models.$queryRaw`SELECT * FROM create_withdrawl(${decoded.id}, ${invoice},
      ${Number(decoded.mtokens)}, ${msatsFee}, ${user.name})`)

  payViaPaymentRequest({
    lnd,
    request: invoice,
    // can't use max_fee_mtokens https://github.com/alexbosworth/ln-service/issues/141
    max_fee: Number(maxFee),
    pathfinding_timeout: 30000
  })

  return withdrawl
}
