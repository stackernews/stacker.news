import { getIdentity, createHodlInvoice, createInvoice, decodePaymentRequest, payViaPaymentRequest, cancelHodlInvoice, getInvoice as getInvoiceFromLnd, getNode, authenticatedLndGrpc, deletePayment, getPayment } from 'ln-service'
import { GraphQLError } from 'graphql'
import crypto from 'crypto'
import serialize from './serial'
import { decodeCursor, LIMIT, nextCursorEncoded } from '@/lib/cursor'
import { SELECT } from './item'
import { lnAddrOptions } from '@/lib/lnurl'
import { msatsToSats, msatsToSatsDecimal, ensureB64 } from '@/lib/format'
import { CLNAutowithdrawSchema, LNDAutowithdrawSchema, amountSchema, lnAddrAutowithdrawSchema, lnAddrSchema, ssValidate, withdrawlSchema } from '@/lib/validate'
import { ANON_BALANCE_LIMIT_MSATS, ANON_INV_PENDING_LIMIT, ANON_USER_ID, BALANCE_LIMIT_MSATS, INVOICE_RETENTION_DAYS, INV_PENDING_LIMIT, USER_IDS_BALANCE_NO_LIMIT } from '@/lib/constants'
import { datePivot } from '@/lib/time'
import assertGofacYourself from './ofac'
import assertApiKeyNotPermitted from './apiKey'
import { createInvoice as createInvoiceCLN } from '@/lib/cln'
import { bolt11Tags } from '@/lib/bolt11'

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
      inv.confirmedPreimage = (await getInvoiceFromLnd({ id: inv.hash, lnd })).secret
    }
  } catch (err) {
    console.error('error fetching invoice from LND', err)
  }

  return inv
}

export async function getWithdrawl (parent, { id }, { me, models, lnd }) {
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

  if (!wdrwl) {
    throw new GraphQLError('withdrawal not found', { extensions: { code: 'BAD_INPUT' } })
  }

  if (wdrwl.user.id !== me.id) {
    throw new GraphQLError('not ur withdrawal', { extensions: { code: 'FORBIDDEN' } })
  }

  try {
    if (wdrwl.status === 'CONFIRMED') {
      wdrwl.preimage = (await getPayment({ id: wdrwl.hash, lnd })).payment.secret
    }
  } catch (err) {
    console.error('error fetching payment from LND', err)
  }

  return wdrwl
}

export function createHmac (hash) {
  const key = Buffer.from(process.env.INVOICE_HMAC_KEY, 'hex')
  return crypto.createHmac('sha256', key).update(Buffer.from(hash, 'hex')).digest('hex')
}

export default {
  Query: {
    invoice: getInvoice,
    wallet: async (parent, { id }, { me, models }) => {
      if (!me) {
        throw new GraphQLError('you must be logged in', { extensions: { code: 'FORBIDDEN' } })
      }

      return await models.wallet.findUnique({
        where: {
          userId: me.id,
          id: Number(id)
        }
      })
    },
    walletByType: async (parent, { type }, { me, models }) => {
      if (!me) {
        throw new GraphQLError('you must be logged in', { extensions: { code: 'FORBIDDEN' } })
      }

      const wallet = await models.wallet.findFirst({
        where: {
          userId: me.id,
          type
        }
      })
      return wallet
    },
    wallets: async (parent, args, { me, models }) => {
      if (!me) {
        throw new GraphQLError('you must be logged in', { extensions: { code: 'FORBIDDEN' } })
      }

      return await models.wallet.findMany({
        where: {
          userId: me.id
        }
      })
    },
    withdrawl: getWithdrawl,
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
          f.description = bolt11Tags(f.bolt11).description
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
    },
    walletLogs: async (parent, args, { me, models }) => {
      if (!me) {
        throw new GraphQLError('you must be logged in', { extensions: { code: 'FORBIDDEN' } })
      }

      return await models.walletLog.findMany({
        where: {
          userId: me.id
        },
        orderBy: {
          createdAt: 'asc'
        }
      })
    }
  },
  WalletDetails: {
    __resolveType (wallet) {
      return wallet.address ? 'WalletLNAddr' : wallet.macaroon ? 'WalletLND' : 'WalletCLN'
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

        const [inv] = await serialize(
          models.$queryRaw`SELECT * FROM create_invoice(${invoice.id}, ${hodlInvoice ? invoice.secret : null}::TEXT, ${invoice.request},
            ${expiresAt}::timestamp, ${amount * 1000}, ${user.id}::INTEGER, ${description}, NULL, NULL,
            ${invLimit}::INTEGER, ${balanceLimit})`,
          { models }
        )

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
      const inv = await serialize(
        models.invoice.update({
          where: {
            hash
          },
          data: {
            cancelled: true
          }
        }),
        { models }
      )
      return inv
    },
    dropBolt11: async (parent, { id }, { me, models, lnd }) => {
      if (!me) {
        throw new GraphQLError('you must be logged in', { extensions: { code: 'UNAUTHENTICATED' } })
      }

      const retention = `${INVOICE_RETENTION_DAYS} days`

      const [invoice] = await models.$queryRaw`
      WITH to_be_updated AS (
        SELECT id, hash, bolt11
        FROM "Withdrawl"
        WHERE "userId" = ${me.id}
        AND id = ${Number(id)}
        AND now() > created_at + interval '${retention}'
        AND hash IS NOT NULL
      ), updated_rows AS (
        UPDATE "Withdrawl"
        SET hash = NULL, bolt11 = NULL
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
            data: { hash: invoice.hash, bolt11: invoice.bolt11 }
          })
          throw new GraphQLError('failed to drop bolt11 from lnd', { extensions: { code: 'BAD_INPUT' } })
        }
      }
      return { id }
    },
    upsertWalletLND: async (parent, { settings, ...data }, { me, models }) => {
      // make sure inputs are base64
      data.macaroon = ensureB64(data.macaroon)
      data.cert = ensureB64(data.cert)

      const walletType = 'LND'
      return await upsertWallet(
        {
          schema: LNDAutowithdrawSchema,
          walletType,
          testConnect: async ({ cert, macaroon, socket }) => {
            try {
              const { lnd } = await authenticatedLndGrpc({
                cert,
                macaroon,
                socket
              })
              const inv = await createInvoice({
                description: 'SN connection test',
                lnd,
                tokens: 0,
                expires_at: new Date()
              })
              // we wrap both calls in one try/catch since connection attempts happen on RPC calls
              await addWalletLog({ wallet: walletType, level: 'SUCCESS', message: 'connected to LND' }, { me, models })
              return inv
            } catch (err) {
              // LND errors are in this shape: [code, type, { err: { code, details, metadata } }]
              const details = err[2]?.err?.details || err.message || err.toString?.()
              await addWalletLog({ wallet: walletType, level: 'ERROR', message: `could not connect to LND: ${details}` }, { me, models })
              throw err
            }
          }
        },
        { settings, data }, { me, models })
    },
    upsertWalletCLN: async (parent, { settings, ...data }, { me, models }) => {
      data.cert = ensureB64(data.cert)

      const walletType = 'CLN'
      return await upsertWallet(
        {
          schema: CLNAutowithdrawSchema,
          walletType,
          testConnect: async ({ socket, rune, cert }) => {
            try {
              const inv = await createInvoiceCLN({
                socket,
                rune,
                cert,
                description: 'SN connection test',
                msats: 'any',
                expiry: 0
              })
              await addWalletLog({ wallet: walletType, level: 'SUCCESS', message: 'connected to CLN' }, { me, models })
              return inv
            } catch (err) {
              const details = err.details || err.message || err.toString?.()
              await addWalletLog({ wallet: walletType, level: 'ERROR', message: `could not connect to CLN: ${details}` }, { me, models })
              throw err
            }
          }
        },
        { settings, data }, { me, models })
    },
    upsertWalletLNAddr: async (parent, { settings, ...data }, { me, models }) => {
      const walletType = 'LIGHTNING_ADDRESS'
      return await upsertWallet(
        {
          schema: lnAddrAutowithdrawSchema,
          walletType,
          testConnect: async ({ address }) => {
            const options = await lnAddrOptions(address)
            await addWalletLog({ wallet: walletType, level: 'SUCCESS', message: 'fetched payment details' }, { me, models })
            return options
          }
        },
        { settings, data }, { me, models })
    },
    removeWallet: async (parent, { id }, { me, models }) => {
      if (!me) {
        throw new GraphQLError('you must be logged in', { extensions: { code: 'UNAUTHENTICATED' } })
      }

      const wallet = await models.wallet.findUnique({ where: { userId: me.id, id: Number(id) } })
      if (!wallet) {
        throw new GraphQLError('wallet not found', { extensions: { code: 'BAD_INPUT' } })
      }

      await models.$transaction([
        models.wallet.delete({ where: { userId: me.id, id: Number(id) } }),
        models.walletLog.create({ data: { userId: me.id, wallet: wallet.type, level: 'SUCCESS', message: 'wallet deleted' } })
      ])

      return true
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

export const addWalletLog = async ({ wallet, level, message }, { me, models }) => {
  try {
    await models.walletLog.create({ data: { userId: me.id, wallet, level, message } })
  } catch (err) {
    console.error('error creating wallet log:', err)
  }
}

async function upsertWallet (
  { schema, walletType, testConnect }, { settings, data }, { me, models }) {
  if (!me) {
    throw new GraphQLError('you must be logged in', { extensions: { code: 'UNAUTHENTICATED' } })
  }
  assertApiKeyNotPermitted({ me })

  await ssValidate(schema, { ...data, ...settings }, { me, models })

  if (testConnect) {
    try {
      await testConnect(data)
    } catch (err) {
      console.error(err)
      await addWalletLog({ wallet: walletType, level: 'ERROR', message: 'failed to attach wallet' }, { me, models })
      throw new GraphQLError('failed to connect to wallet', { extensions: { code: 'BAD_INPUT' } })
    }
  }

  const { id, ...walletData } = data
  const { autoWithdrawThreshold, autoWithdrawMaxFeePercent, priority } = settings

  const txs = [
    models.user.update({
      where: { id: me.id },
      data: {
        autoWithdrawMaxFeePercent,
        autoWithdrawThreshold
      }
    })
  ]

  if (priority) {
    txs.push(
      models.wallet.updateMany({
        where: {
          userId: me.id
        },
        data: {
          priority: 0
        }
      }))
  }

  const walletName = walletType === 'LND'
    ? 'walletLND'
    : walletType === 'CLN' ? 'walletCLN' : 'walletLightningAddress'
  if (id) {
    txs.push(
      models.wallet.update({
        where: { id: Number(id), userId: me.id },
        data: {
          priority: priority ? 1 : 0,
          [walletName]: {
            update: {
              where: { walletId: Number(id) },
              data: walletData
            }
          }
        }
      }),
      models.walletLog.create({ data: { userId: me.id, wallet: walletType, level: 'SUCCESS', message: 'wallet updated' } })
    )
  } else {
    txs.push(
      models.wallet.create({
        data: {
          priority: Number(priority),
          userId: me.id,
          type: walletType,
          [walletName]: {
            create: walletData
          }
        }
      }),
      models.walletLog.create({ data: { userId: me.id, wallet: walletType, level: 'SUCCESS', message: 'wallet created' } })
    )
  }

  await models.$transaction(txs)
  return true
}

export async function createWithdrawal (parent, { invoice, maxFee }, { me, models, lnd, headers, walletId = null }) {
  assertApiKeyNotPermitted({ me })
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

  const autoWithdraw = !!walletId
  // create withdrawl transactionally (id, bolt11, amount, fee)
  const [withdrawl] = await serialize(
    models.$queryRaw`SELECT * FROM create_withdrawl(${decoded.id}, ${invoice},
      ${Number(decoded.mtokens)}, ${msatsFee}, ${user.name}, ${autoWithdraw}, ${walletId}::INTEGER)`,
    { models }
  )

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
  assertApiKeyNotPermitted({ me })

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
    if (autoWithdraw && decoded.destination === ourPubkey && process.env.NODE_ENV === 'production') {
      // unset lnaddr so we don't trigger another withdrawal with same destination
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

  // take pr and createWithdrawl
  return await createWithdrawal(parent, { invoice: res.pr, maxFee }, { me, models, lnd, headers, autoWithdraw })
}
