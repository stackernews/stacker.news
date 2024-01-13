import { getIdentity, createHodlInvoice, createInvoice, decodePaymentRequest, payViaPaymentRequest, cancelHodlInvoice, getInvoice as getInvoiceFromLnd, getNode } from 'ln-service'
import { GraphQLError } from 'graphql'
import crypto from 'crypto'
import serialize from './serial'
import { decodeCursor, LIMIT, nextCursorEncoded } from '../../lib/cursor'
import lnpr from 'bolt11'
import { SELECT } from './item'
import { lnAddrOptions, lnurlPayDescriptionHash } from '../../lib/lnurl'
import { msatsToSats, msatsToSatsDecimal } from '../../lib/format'
import { amountSchema, lnAddrSchema, ssValidate, withdrawlSchema } from '../../lib/validate'
import { ANON_BALANCE_LIMIT_MSATS, ANON_INV_PENDING_LIMIT, ANON_USER_ID, BALANCE_LIMIT_MSATS, INV_PENDING_LIMIT, USER_IDS_BALANCE_NO_LIMIT } from '../../lib/constants'
import { datePivot } from '../../lib/time'
import assertGofacYourself from './ofac'

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

  try {
    if (inv.confirmedAt) {
      const lnInv = await getInvoiceFromLnd({ id: inv.hash, lnd })
      inv.confirmedPreimage = lnInv.secret
    }
  } catch (err) {
    console.error('error fetching invoice from LND', err)
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
    numBolt11s: async (parent, args, { me, models, lnd }) => {
      if (!me) {
        throw new GraphQLError('you must be logged in', { extensions: { code: 'FORBIDDEN' } })
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
        throw new GraphQLError('you must be logged in', { extensions: { code: 'FORBIDDEN' } })
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
                              WHEN "expiresAt" <= $2 THEN 'EXPIRED'
                              WHEN cancelled THEN 'CANCELLED'
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
              id, created_at as "createdAt",
              COALESCE("msatsPaid", "msatsPaying") as msats,
              'withdrawal' as type,
              jsonb_build_object(
                'bolt11', bolt11,
                'autoWithdraw', "autoWithdraw",
                'status', COALESCE(status::text, 'PENDING'),
                'msatsFee', COALESCE("msatsFeePaid", "msatsFeePaying")) as other
            FROM "Withdrawl"
            WHERE "userId" = $1
            AND created_at <= $2)`
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
          const inv = lnpr.decode(f.bolt11)
          if (inv) {
            const { tags } = inv
            for (const tag of tags) {
              if (tag.tagName === 'description') {
                // prioritize description from bolt11 over description from our DB
                f.description = tag.data
                break
              }
            }
          }
        }

        switch (f.type) {
          case 'withdrawal':
            f.msats = (-1 * Number(f.msats)) - Number(f.msatsFee)
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
    }
  },

  Mutation: {
    createInvoice: async (parent, { amount, hodlInvoice = false, expireSecs = 3600 }, { me, models, lnd, headers }) => {
      await ssValidate(amountSchema, { amount })
      await assertGofacYourself({ models, headers })

      let expirePivot = { seconds: expireSecs }
      let invLimit = INV_PENDING_LIMIT
      let balanceLimit = (hodlInvoice || USER_IDS_BALANCE_NO_LIMIT.includes(Number(me?.id))) ? 0 : BALANCE_LIMIT_MSATS
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

        console.log('invoice', balanceLimit)

        const [inv] = await serialize(models,
          models.$queryRaw`SELECT * FROM create_invoice(${invoice.id}, ${hodlInvoice ? invoice.secret : null}::TEXT, ${invoice.request},
            ${expiresAt}::timestamp, ${amount * 1000}, ${user.id}::INTEGER, ${description}, NULL, NULL,
            ${invLimit}::INTEGER, ${balanceLimit})`)

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
    sendToLnAddr,
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
    },
    dropBolt11: async (parent, { id }, { me, models }) => {
      if (!me) {
        throw new GraphQLError('you must be logged in', { extensions: { code: 'UNAUTHENTICATED' } })
      }

      await models.withdrawl.update({
        where: {
          userId: me.id,
          id: Number(id),
          createdAt: {
            lte: datePivot(new Date(), { days: -7 })
          }
        },
        data: { bolt11: null, hash: null }
      })
      return { id }
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
  }
}

export async function createWithdrawal (parent, { invoice, maxFee }, { me, models, lnd, headers, autoWithdraw = false }) {
  await ssValidate(withdrawlSchema, { invoice, maxFee })
  await assertGofacYourself({ models, headers })

  // remove 'lightning:' prefix if present
  invoice = invoice.replace(/^lightning:/, '')

  // decode invoice to get amount
  let decoded, node
  try {
    decoded = await decodePaymentRequest({ lnd, request: invoice })
  } catch (error) {
    console.log(error)
    throw new GraphQLError('could not decode invoice', { extensions: { code: 'BAD_INPUT' } })
  }

  try {
    node = await getNode({ lnd, public_key: decoded.destination, is_omitting_channels: true })
  } catch (error) {
    // likely not found if it's an unannounced channel, e.g. phoenix
    console.log(error)
  }

  if (node) {
    for (const { socket } of node.sockets) {
      const ip = socket.split(':')[0]
      await assertGofacYourself({ models, headers, ip })
    }
  }

  if (!decoded.mtokens || BigInt(decoded.mtokens) <= 0) {
    throw new GraphQLError('your invoice must specify an amount', { extensions: { code: 'BAD_INPUT' } })
  }

  const msatsFee = Number(maxFee) * 1000

  const user = await models.user.findUnique({ where: { id: me.id } })

  // create withdrawl transactionally (id, bolt11, amount, fee)
  const [withdrawl] = await serialize(models,
    models.$queryRaw`SELECT * FROM create_withdrawl(${decoded.id}, ${invoice},
      ${Number(decoded.mtokens)}, ${msatsFee}, ${user.name}, ${autoWithdraw})`)

  payViaPaymentRequest({
    lnd,
    request: invoice,
    // can't use max_fee_mtokens https://github.com/alexbosworth/ln-service/issues/141
    max_fee: Number(maxFee),
    pathfinding_timeout: 30000
  }).catch(console.error)

  return withdrawl
}

export async function sendToLnAddr (parent, { addr, amount, maxFee, comment, ...payer },
  { me, models, lnd, headers, autoWithdraw = false }) {
  if (!me) {
    throw new GraphQLError('you must be logged in', { extensions: { code: 'FORBIDDEN' } })
  }

  const options = await lnAddrOptions(addr)
  await ssValidate(lnAddrSchema, { addr, amount, maxFee, comment, ...payer }, options)

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
    const decoded = await decodePaymentRequest({ lnd, request: res.pr })
    const ourPubkey = (await getIdentity({ lnd })).public_key
    if (autoWithdraw && decoded.destination === ourPubkey) {
      // unset lnaddr so we don't trigger another withdrawal with same destination
      await models.user.update({
        where: { id: me.id },
        data: {
          lnAddr: null,
          autoWithdrawThreshold: null,
          autoWithdrawMaxFeePercent: null
        }
      })
      throw new Error('automated withdrawals to other stackers are not allowed')
    }
    if (decoded.description_hash !== lnurlPayDescriptionHash(`${options.metadata}${stringifiedPayerData}`)) {
      throw new Error('description hash does not match')
    }
    if (!decoded.mtokens || BigInt(decoded.mtokens) !== BigInt(milliamount)) {
      throw new Error('invoice has incorrect amount')
    }
  } catch (e) {
    console.log(e)
    throw e
  }

  // take pr and createWithdrawl
  return await createWithdrawal(parent, { invoice: res.pr, maxFee }, { me, models, lnd, headers, autoWithdraw })
}
