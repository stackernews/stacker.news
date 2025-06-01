import {
  getInvoice as getInvoiceFromLnd, deletePayment, getPayment,
  parsePaymentRequest
} from 'ln-service'
import crypto, { timingSafeEqual } from 'crypto'
import { decodeCursor, LIMIT, nextCursorEncoded } from '@/lib/cursor'
import { SELECT, itemQueryWithMeta } from './item'
import { formatMsats, msatsToSats, msatsToSatsDecimal, satsToMsats } from '@/lib/format'
import {
  USER_ID, INVOICE_RETENTION_DAYS,
  PAID_ACTION_PAYMENT_METHODS,
  WALLET_RETRY_AFTER_MS,
  WALLET_RETRY_BEFORE_MS,
  WALLET_MAX_RETRIES
} from '@/lib/constants'
import { amountSchema, validateSchema, withdrawlSchema, lnAddrSchema } from '@/lib/validate'
import assertGofacYourself from './ofac'
import assertApiKeyNotPermitted from './apiKey'
import { bolt11Tags } from '@/lib/bolt11'
import { finalizeHodlInvoice } from '@/worker/wallet'
import { lnAddrOptions } from '@/lib/lnurl'
import { GqlAuthenticationError, GqlAuthorizationError, GqlInputError } from '@/lib/error'
import { getNodeSockets, getOurPubkey } from '../lnd'
import performPaidAction from '../paidAction'
import performPayingAction from '../payingAction'
import { logContextFromBolt11 } from '@/wallets/server/logger'

export async function getInvoice (parent, { id }, { me, models, lnd }) {
  const inv = await models.invoice.findUnique({
    where: {
      id: Number(id)
    }
  })

  if (!inv) {
    throw new GqlInputError('invoice not found')
  }

  if (inv.userId === USER_ID.anon) {
    return inv
  }
  if (!me) {
    throw new GqlAuthenticationError()
  }
  if (inv.userId !== me.id) {
    throw new GqlInputError('not ur invoice')
  }

  return inv
}

export async function getWithdrawl (parent, { id }, { me, models, lnd }) {
  if (!me) {
    throw new GqlAuthenticationError()
  }

  const wdrwl = await models.withdrawl.findUnique({
    where: {
      id: Number(id)
    }
  })

  if (!wdrwl) {
    throw new GqlInputError('withdrawal not found')
  }

  if (wdrwl.userId !== me.id) {
    throw new GqlInputError('not ur withdrawal')
  }

  return wdrwl
}

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
    invoice: getInvoice,
    withdrawl: getWithdrawl,
    direct: async (parent, { id }, { me, models }) => {
      if (!me) {
        throw new GqlAuthenticationError()
      }

      return await models.directPayment.findUnique({
        where: {
          id: Number(id),
          receiverId: me.id
        }
      })
    },
    numBolt11s: async (parent, args, { me, models, lnd }) => {
      if (!me) {
        throw new GqlAuthenticationError()
      }

      return await models.withdrawl.count({
        where: {
          userId: me.id,
          hash: { not: null }
        }
      })
    },
    connectAddress: async (parent, args, { lnd }) => {
      return process.env.LND_CONNECT_ADDRESS
    },
    walletHistory: async (parent, { cursor, inc }, { me, models, lnd }) => {
      const decodedCursor = decodeCursor(cursor)
      if (!me) {
        throw new GqlAuthenticationError()
      }

      const include = new Set(inc?.split(','))
      const queries = []

      if (include.has('invoice')) {
        queries.push(
          `(SELECT
              id, created_at as "createdAt", COALESCE("msatsReceived", "msatsRequested") as msats,
              'invoice' as type,
              jsonb_build_object(
                'bolt11', bolt11,
                'status', CASE WHEN "confirmedAt" IS NOT NULL THEN 'CONFIRMED'
                              WHEN cancelled THEN 'CANCELLED'
                              WHEN "expiresAt" <= $2 AND NOT "isHeld" THEN 'EXPIRED'
                              ELSE 'PENDING' END,
                'description', "desc",
                'invoiceComment', comment,
                'invoicePayerData', "lud18Data") as other
            FROM "Invoice"
            WHERE "userId" = $1
            AND created_at <= $2)`
        )
      }

      if (include.has('withdrawal')) {
        queries.push(
          `(SELECT
              "Withdrawl".id, "Withdrawl".created_at as "createdAt",
              COALESCE("msatsPaid", "msatsPaying") as msats,
              CASE WHEN bool_and("InvoiceForward".id IS NULL) THEN 'withdrawal' ELSE 'p2p' END as type,
              jsonb_build_object(
                'bolt11', "Withdrawl".bolt11,
                'autoWithdraw', "autoWithdraw",
                'status', COALESCE(status::text, 'PENDING'),
                'msatsFee', COALESCE("msatsFeePaid", "msatsFeePaying")) as other
            FROM "Withdrawl"
            LEFT JOIN "InvoiceForward" ON "Withdrawl".id = "InvoiceForward"."withdrawlId"
            WHERE "Withdrawl"."userId" = $1
            AND "Withdrawl".created_at <= $2
            GROUP BY "Withdrawl".id)`
        )
        queries.push(
          `(SELECT id, created_at as "createdAt", msats, 'direct' as type,
              jsonb_build_object(
                'bolt11', bolt11,
                'description', "desc",
                'invoiceComment', comment,
                'invoicePayerData', "lud18Data") as other
            FROM "DirectPayment"
            WHERE "DirectPayment"."receiverId" = $1
            AND "DirectPayment".created_at <= $2)`
        )
      }

      if (include.has('stacked')) {
        // query1 - get all sats stacked as OP or as a forward
        queries.push(
          `(SELECT
              "Item".id,
              MAX("ItemAct".created_at) AS "createdAt",
              FLOOR(
                SUM("ItemAct".msats)
                * (CASE WHEN "Item"."userId" = $1 THEN
                    COALESCE(1 - ((SELECT SUM(pct) FROM "ItemForward" WHERE "itemId" = "Item".id) / 100.0), 1)
                  ELSE
                    (SELECT pct FROM "ItemForward" WHERE "itemId" = "Item".id AND "userId" = $1) / 100.0
                  END)
              ) AS msats,
              'stacked' AS type, NULL::JSONB AS other
            FROM "ItemAct"
            JOIN "Item" ON "ItemAct"."itemId" = "Item".id
            -- only join to with item forward for items where we aren't the OP
            LEFT JOIN "ItemForward" ON "ItemForward"."itemId" = "Item".id AND "Item"."userId" <> $1
            WHERE "ItemAct".act = 'TIP'
            AND ("Item"."userId" = $1 OR "ItemForward"."userId" = $1)
            AND "ItemAct".created_at <= $2
            AND ("ItemAct"."invoiceActionState" IS NULL OR "ItemAct"."invoiceActionState" = 'PAID')
            GROUP BY "Item".id)`
        )
        queries.push(
          `(SELECT
              min("Earn".id) as id, created_at as "createdAt",
              sum(msats) as msats, 'earn' as type, NULL::JSONB AS other
            FROM "Earn"
            WHERE "Earn"."userId" = $1 AND "Earn".created_at <= $2
            GROUP BY "userId", created_at)`
        )
        queries.push(
          `(SELECT id, created_at as "createdAt", msats, 'referral' as type, NULL::JSONB AS other
            FROM "ReferralAct"
            WHERE "ReferralAct"."referrerId" = $1 AND "ReferralAct".created_at <= $2)`
        )
        queries.push(
          `(SELECT id, created_at as "createdAt", msats, 'revenue' as type,
              jsonb_build_object('subName', "SubAct"."subName") as other
            FROM "SubAct"
            WHERE "userId" = $1 AND type = 'REVENUE'
            AND created_at <= $2)`
        )
      }

      if (include.has('spent')) {
        queries.push(
          `(SELECT "Item".id, MAX("ItemAct".created_at) as "createdAt", sum("ItemAct".msats) as msats,
              'spent' as type, NULL::JSONB AS other
            FROM "ItemAct"
            JOIN "Item" on "ItemAct"."itemId" = "Item".id
            WHERE "ItemAct"."userId" = $1
            AND "ItemAct".created_at <= $2
            AND ("ItemAct"."invoiceActionState" IS NULL OR "ItemAct"."invoiceActionState" = 'PAID')
            GROUP BY "Item".id)`
        )
        queries.push(
          `(SELECT id, created_at as "createdAt", sats * 1000 as msats,'donation' as type, NULL::JSONB AS other
            FROM "Donation"
            WHERE "userId" = $1
            AND created_at <= $2)`
        )
        queries.push(
            `(SELECT id, created_at as "createdAt", msats, 'billing' as type,
                jsonb_build_object('subName', "SubAct"."subName") as other
              FROM "SubAct"
              WHERE "userId" = $1 AND type = 'BILLING'
              AND created_at <= $2)`
        )
      }

      if (queries.length === 0) {
        return {
          cursor: null,
          facts: []
        }
      }

      let history = await models.$queryRawUnsafe(`
        ${queries.join(' UNION ALL ')}
        ORDER BY "createdAt" DESC
        OFFSET $3
        LIMIT ${LIMIT}`,
      me.id, decodedCursor.time, decodedCursor.offset)

      history = history.map(f => {
        f = { ...f, ...f.other }

        if (f.bolt11) {
          f.description = bolt11Tags(f.bolt11).description
        }

        switch (f.type) {
          case 'withdrawal':
            f.msats = (-1 * Number(f.msats)) - Number(f.msatsFee)
            break
          case 'p2p':
            f.msats = -1 * Number(f.msats)
            break
          case 'spent':
          case 'donation':
          case 'billing':
            f.msats *= -1
            break
          default:
            break
        }

        return f
      })

      return {
        cursor: history.length === LIMIT ? nextCursorEncoded(decodedCursor) : null,
        facts: history
      }
    },
    failedInvoices: async (parent, args, { me, models }) => {
      if (!me) {
        throw new GqlAuthenticationError()
      }
      return await models.$queryRaw`
        SELECT * FROM "Invoice"
        WHERE "userId" = ${me.id}
        AND "actionState" = 'FAILED'
        -- never retry if user has cancelled the invoice manually
        AND "userCancel" = false
        AND "cancelledAt" < now() - ${`${WALLET_RETRY_AFTER_MS} milliseconds`}::interval
        AND "cancelledAt" > now() - ${`${WALLET_RETRY_BEFORE_MS} milliseconds`}::interval
        AND "paymentAttempt" < ${WALLET_MAX_RETRIES}
        AND (
          "actionType" = 'ITEM_CREATE' OR
          "actionType" = 'ZAP' OR
          "actionType" = 'DOWN_ZAP' OR
          "actionType" = 'POLL_VOTE' OR
          "actionType" = 'BOOST'
        )
        ORDER BY id DESC`
    }
  },
  WalletOrTemplate: {
    __resolveType: walletOrTemplate => walletOrTemplate.__resolveType
  },
  UserWallet: {
    name: wallet => wallet.template.name,
    send: wallet => wallet.protocols.some(protocol => protocol.send),
    receive: wallet => wallet.protocols.some(protocol => !protocol.send)
  },
  WalletTemplate: {
    send: walletTemplate => walletTemplate.sendProtocols.length > 0,
    receive: walletTemplate => walletTemplate.recvProtocols.length > 0,
    protocols: walletTemplate => {
      return [
        ...walletTemplate.sendProtocols.map(protocol => ({
          id: `WalletTemplate-${walletTemplate.id}-${protocol}-send`,
          name: protocol,
          send: true
        })),
        ...walletTemplate.recvProtocols.map(protocol => ({
          id: `WalletTemplate-${walletTemplate.id}-${protocol}-recv`,
          name: protocol,
          send: false
        }))
      ]
    }
  },
  WalletProtocol: {
    name: protocol => protocol.protocol
  },
  WalletProtocolConfig: {
    __resolveType: config => config.__resolveType
  },
  InvoiceOrDirect: {
    __resolveType: invoiceOrDirect => invoiceOrDirect.__resolveType
  },
  Mutation: {
    createInvoice: async (parent, { amount }, { me, models, lnd, headers }) => {
      await validateSchema(amountSchema, { amount })
      await assertGofacYourself({ models, headers })

      const { invoice, paymentMethod } = await performPaidAction('RECEIVE', {
        msats: satsToMsats(amount)
      }, { models, lnd, me })

      return {
        ...invoice,
        __resolveType:
          paymentMethod === PAID_ACTION_PAYMENT_METHODS.DIRECT ? 'Direct' : 'Invoice'
      }
    },
    createWithdrawl: createWithdrawal,
    sendToLnAddr,
    cancelInvoice: async (parent, { hash, hmac, userCancel }, { me, models, lnd, boss }) => {
      // stackers can cancel their own invoices without hmac
      if (me && !hmac) {
        const inv = await models.invoice.findUnique({ where: { hash } })
        if (!inv) throw new GqlInputError('invoice not found')
        if (inv.userId !== me.id) throw new GqlInputError('not ur invoice')
      } else {
        verifyHmac(hash, hmac)
      }
      await finalizeHodlInvoice({ data: { hash }, lnd, models, boss })
      return await models.invoice.update({ where: { hash }, data: { userCancel: !!userCancel } })
    },
    dropBolt11: async (parent, { hash }, { me, models, lnd }) => {
      if (!me) {
        throw new GqlAuthenticationError()
      }

      const retention = `${INVOICE_RETENTION_DAYS} days`

      const [invoice] = await models.$queryRaw`
        WITH to_be_updated AS (
          SELECT id, hash, bolt11
          FROM "Withdrawl"
          WHERE "userId" = ${me.id}
          AND hash = ${hash}
          AND now() > created_at + ${retention}::INTERVAL
          AND hash IS NOT NULL
          AND status IS NOT NULL
        ), updated_rows AS (
          UPDATE "Withdrawl"
          SET hash = NULL, bolt11 = NULL, preimage = NULL
          FROM to_be_updated
          WHERE "Withdrawl".id = to_be_updated.id)
        SELECT * FROM to_be_updated;`

      if (invoice) {
        try {
          await deletePayment({ id: invoice.hash, lnd })
        } catch (error) {
          console.error(error)
          await models.withdrawl.update({
            where: { id: invoice.id },
            data: { hash: invoice.hash, bolt11: invoice.bolt11, preimage: invoice.preimage }
          })
          throw new GqlInputError('failed to drop bolt11 from lnd')
        }
      }

      await models.$queryRaw`
        UPDATE "DirectPayment"
        SET hash = NULL, bolt11 = NULL, preimage = NULL
        WHERE "receiverId" = ${me.id}
        AND hash = ${hash}
        AND now() > created_at + ${retention}::INTERVAL
        AND hash IS NOT NULL`

      return true
    },
    buyCredits: async (parent, { credits }, { me, models, lnd }) => {
      return await performPaidAction('BUY_CREDITS', { credits }, { models, me, lnd })
    }
  },

  Withdrawl: {
    satsPaying: w => msatsToSats(w.msatsPaying),
    satsPaid: w => msatsToSats(w.msatsPaid),
    satsFeePaying: w => w.invoiceForward ? 0 : msatsToSats(w.msatsFeePaying),
    satsFeePaid: w => w.invoiceForward ? 0 : msatsToSats(w.msatsFeePaid),
    // we never want to fetch the sensitive data full monty in nested resolvers
    forwardedActionType: async (withdrawl, args, { models }) => {
      return (await models.invoiceForward.findUnique({
        where: { withdrawlId: Number(withdrawl.id) },
        include: {
          invoice: true
        }
      }))?.invoice?.actionType
    },
    preimage: async (withdrawl, args, { lnd }) => {
      try {
        if (withdrawl.status === 'CONFIRMED' && withdrawl.hash) {
          return withdrawl.preimage ?? (await getPayment({ id: withdrawl.hash, lnd })).payment.secret
        }
      } catch (err) {
        console.error('error fetching payment from LND', err)
      }
    }
  },
  Direct: {
    nostr: async (direct, args, { models }) => {
      try {
        return JSON.parse(direct.desc)
      } catch (err) {
      }

      return null
    },
    sats: direct => msatsToSats(direct.msats)
  },

  Invoice: {
    satsReceived: i => msatsToSats(i.msatsReceived),
    satsRequested: i => msatsToSats(i.msatsRequested),
    // we never want to fetch the sensitive data full monty in nested resolvers
    forwardStatus: async (invoice, args, { models }) => {
      const forward = await models.invoiceForward.findUnique({
        where: { invoiceId: Number(invoice.id) },
        include: {
          withdrawl: true
        }
      })
      return forward?.withdrawl?.status
    },
    forwardedSats: async (invoice, args, { models }) => {
      const msats = (await models.invoiceForward.findUnique({
        where: { invoiceId: Number(invoice.id) },
        include: {
          withdrawl: true
        }
      }))?.withdrawl?.msatsPaid
      return msats ? msatsToSats(msats) : null
    },
    invoiceForward: async (invoice, args, { models }) => {
      return !!invoice.invoiceForward || !!(await models.invoiceForward.findUnique({ where: { invoiceId: Number(invoice.id) } }))
    },
    nostr: async (invoice, args, { models }) => {
      try {
        return JSON.parse(invoice.desc)
      } catch (err) {
      }

      return null
    },
    confirmedPreimage: async (invoice, args, { lnd }) => {
      try {
        if (invoice.confirmedAt) {
          return invoice.preimage ?? (await getInvoiceFromLnd({ id: invoice.hash, lnd })).secret
        }
      } catch (err) {
        console.error('error fetching invoice from LND', err)
      }

      return null
    },
    item: async (invoice, args, { models, me }) => {
      if (!invoice.actionId) return null
      switch (invoice.actionType) {
        case 'ITEM_CREATE':
        case 'ZAP':
        case 'DOWN_ZAP':
        case 'POLL_VOTE':
        case 'BOOST':
          return (await itemQueryWithMeta({
            me,
            models,
            query: `
              ${SELECT}
              FROM "Item"
              WHERE id = $1`
          }, Number(invoice.actionId)))?.[0]
        default:
          return null
      }
    },
    itemAct: async (invoice, args, { models, me }) => {
      const action2act = {
        ZAP: 'TIP',
        DOWN_ZAP: 'DONT_LIKE_THIS',
        POLL_VOTE: 'POLL',
        BOOST: 'BOOST'
      }
      switch (invoice.actionType) {
        case 'ZAP':
        case 'DOWN_ZAP':
        case 'POLL_VOTE':
        case 'BOOST':
          return (await models.$queryRaw`
              SELECT id, act, "invoiceId", "invoiceActionState", msats
              FROM "ItemAct"
              WHERE "ItemAct"."invoiceId" = ${Number(invoice.id)}::INTEGER
              AND "ItemAct"."userId" = ${me?.id}::INTEGER
              AND act = ${action2act[invoice.actionType]}::"ItemActType"`
          )?.[0]
        default:
          return null
      }
    }
  },

  Fact: {
    item: async (fact, args, { models }) => {
      if (fact.type !== 'spent' && fact.type !== 'stacked') {
        return null
      }
      const [item] = await models.$queryRawUnsafe(`
        ${SELECT}
        FROM "Item"
        WHERE id = $1`, Number(fact.id))

      return item
    },
    sats: fact => msatsToSatsDecimal(fact.msats)
  },

  WalletLogEntry: {
    context: async ({ level, context, invoice, withdrawal }, args, { models }) => {
      const isError = ['error', 'warn'].includes(level.toLowerCase())

      if (withdrawal) {
        return {
          ...await logContextFromBolt11(withdrawal.bolt11),
          ...(withdrawal.preimage ? { preimage: withdrawal.preimage } : {}),
          ...(isError ? { max_fee: formatMsats(withdrawal.msatsFeePaying) } : {})
        }
      }

      // XXX never return invoice as context because it might leak sensitive sender details
      // if (invoice) { ... }

      return context
    }
  }
}

// TODO(wallet-v2): implement wallet resolvers
export default resolvers

export async function createWithdrawal (parent, { invoice, maxFee }, { me, models, lnd, headers, wallet, logger }) {
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

  // check if there's an invoice with same hash that has an invoiceForward
  // we can't allow this because it creates two outgoing payments from our node
  // with the same hash
  const selfPayment = await models.invoice.findUnique({
    where: { hash: decoded.id },
    include: { invoiceForward: true }
  })
  if (selfPayment?.invoiceForward) {
    throw new GqlInputError('SN cannot pay an invoice that SN is proxying')
  }

  return await performPayingAction({ bolt11: invoice, maxFee, walletId: wallet?.id }, { me, models, lnd })
}

export async function sendToLnAddr (parent, { addr, amount, maxFee, comment, ...payer },
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

export async function fetchLnAddrInvoice (
  { addr, amount, maxFee, comment, ...payer },
  {
    me, models, lnd, autoWithdraw = false
  }) {
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
    const ourPubkey = await getOurPubkey({ lnd })
    if (autoWithdraw && decoded.destination === ourPubkey && process.env.NODE_ENV === 'production') {
      // unset lnaddr so we don't trigger another withdrawal with same destination
      // TODO(wallet-v2): use UserWallet instead of Wallet table
      await models.wallet.deleteMany({
        where: { userId: me.id, type: 'LIGHTNING_ADDRESS' }
      })
      throw new Error('automated withdrawals to other stackers are not allowed')
    }
    if (!decoded.mtokens || BigInt(decoded.mtokens) !== BigInt(milliamount)) {
      throw new Error('invoice has incorrect amount')
    }
  } catch (e) {
    console.log(e)
    throw e
  }

  return res
}
