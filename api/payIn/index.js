import { PAID_ACTION_PAYMENT_METHODS, USER_ID } from '@/lib/constants'
import { Prisma } from '@prisma/client'
import { wrapBolt11 } from '@/wallets/server'
import { createHodlInvoice, createInvoice, parsePaymentRequest } from 'ln-service'
import { datePivot } from '@/lib/time'
import lnd from '../lnd'
import payInTypeModules from './types'

export default async function payIn (payInType, payInArgs, context) {
  try {
    const { me } = context
    const payInModule = payInTypeModules[payInType]

    console.group('payIn', payInType, payInArgs)

    if (!payInModule) {
      throw new Error(`Invalid payIn type ${payInType}`)
    }

    if (!me && !payInModule.anonable) {
      throw new Error('You must be logged in to perform this action')
    }

    const payIn = {
      payInType,
      userId: me?.id ?? USER_ID.anon,
      cost: await payInModule.getCost(payInArgs, context)
    }

    return await payInPerform(payIn, payInArgs, context)
  } catch (e) {
    console.error('performPaidAction failed', e)
    throw e
  } finally {
    console.groupEnd()
  }
}

async function getPayInCustodialTokens (tx, mCustodialCost, { me, models }) {
  if (!me) {
    return []
  }
  const { mcredits, msats, mcreditsBefore, msatsBefore } = await tx.$queryRaw`
    UPDATE users
    SET
      -- if we have enough mcredits, subtract the cost from mcredits
      -- otherwise, set mcredits to 0 and subtract the rest from msats
      mcredits = CASE
        WHEN mcredits >= ${mCustodialCost} THEN mcredits - ${mCustodialCost}
        ELSE 0
      END,
      -- if we have enough msats, subtract the remaining cost from msats
      -- otherwise, set msats to 0
      msats = CASE
        WHEN mcredits >= ${mCustodialCost} THEN msats
        WHEN msats >= ${mCustodialCost} - mcredits THEN msats - (${mCustodialCost} - mcredits)
        ELSE 0
      END
    FROM (SELECT id, mcredits, msats FROM users WHERE id = ${me.id} FOR UPDATE) before
    WHERE users.id = before.id
    RETURNING mcredits, msats, before.mcredits as mcreditsBefore, before.msats as msatsBefore`

  const payInAssets = []
  if (mcreditsBefore > mcredits) {
    payInAssets.push({
      payInAssetType: 'CREDITS',
      masset: mcreditsBefore - mcredits,
      massetBefore: mcreditsBefore
    })
  }
  if (msatsBefore > msats) {
    payInAssets.push({
      payInAssetType: 'SATS',
      masset: msatsBefore - msats,
      massetBefore: msatsBefore
    })
  }
  return payInAssets
}

async function isPessimistic (payIn, { me }) {
  const payInModule = payInTypeModules[payIn.payInType]
  return !me || !payInModule.paymentMethods.includes(PAID_ACTION_PAYMENT_METHODS.OPTIMISTIC)
}

async function payInPerform (payIn, payInArgs, { me, models }) {
  const payInModule = payInTypeModules[payIn.payInType]

  const { payOutCustodialTokens, payOutBolt11 } = await payInModule.getPayOuts(models, payIn, payInArgs, { me })
  // we deduct the p2p payOut from what can be paid with custodial tokens
  const mCustodialCost = payIn.mcost - (payOutBolt11?.msats ?? 0n)

  const result = await models.$transaction(async tx => {
    const payInCustodialTokens = await getPayInCustodialTokens(tx, mCustodialCost, { me, models })
    const mCustodialPaid = payInCustodialTokens.reduce((acc, token) => acc + token.mtokens, 0n)

    // TODO: what if remainingCost < 1000n or not a multiple of 1000n?
    // the remaining cost will be paid with an invoice
    const mCostRemaining = mCustodialCost - mCustodialPaid + (payOutBolt11?.msats ?? 0n)

    const payInResult = await tx.payIn.create({
      data: {
        payInType: payIn.payInType,
        mcost: payIn.mcost,
        payInState: 'PENDING_INVOICE_CREATION',
        payInStateChangedAt: new Date(), // TODO: set with a trigger
        userId: payIn.userId,
        pessimisticEnv: {
          create: mCostRemaining > 0n && isPessimistic(payIn, { me }) ? { args: payInArgs } : null
        },
        payInCustodialTokens: {
          createMany: {
            data: payInCustodialTokens
          }
        },
        payOutCustodialTokens: {
          createMany: {
            data: payOutCustodialTokens
          }
        },
        payOutBolt11: {
          create: payOutBolt11
        }
      },
      include: {
        payInCustodialTokens: true,
        user: true
      }
    })

    // if it's pessimistic, we don't perform the action until the invoice is held
    if (payInResult.pessimisticEnv) {
      return {
        payIn: payInResult,
        mCostRemaining
      }
    }

    // if it's optimistic or already paid, we perform the action
    const result = await payInModule.perform(tx, payInResult, payInArgs, { models, me })

    // if there's remaining cost, we return the result but don't run onPaid
    if (mCostRemaining > 0n) {
      // transactionally insert a job to check if the required invoice is added
      // we can't do it before because we don't know the amount of the invoice
      // and we want to refund the custodial tokens if the invoice creation fails
      // TODO: consider timeouts of wrapped invoice creation ... ie 30 seconds might not be enough
      await tx.$executeRaw`INSERT INTO pgboss.job (name, data, startafter, priority)
        VALUES ('checkPayIn', jsonb_build_object('id', ${payInResult.id}::INTEGER), now() + interval '30 seconds', 1000)`
      return {
        payIn: payInResult,
        result,
        mCostRemaining
      }
    }

    // if it's already paid, we run onPaid and do payOuts in the same transaction
    await onPaid(tx, payInResult, payInArgs, { models, me })
    return {
      payIn: payInResult,
      result,
      mCostRemaining: 0n
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted })

  if (result.mCostRemaining > 0n) {
    try {
      return {
        payIn: await payInAddInvoice(result.mCostRemaining, result.payIn, payInArgs, { models, me }),
        result: result.result
      }
    } catch (e) {
      await models.$transaction(async tx => {
        await tx.payIn.update({
          where: { id: payIn.id, payInState: 'PENDING_INVOICE_CREATION' },
          data: { payInState: 'FAILED', payInFailureReason: 'INVOICE_CREATION_FAILED', payInStateChangedAt: new Date() }
        })
        await onFail(tx, payIn, payInArgs, { models, me })
      })
      console.error('payInAddInvoice failed', e)
      throw e
    }
  }

  return result.result
}

const INVOICE_EXPIRE_SECS = 600

async function createBolt11 (mCostRemaining, payIn, payInArgs, { models, me }) {
  const createLNDinvoice = payIn.pessimisticEnv ? createHodlInvoice : createInvoice
  const expiresAt = datePivot(new Date(), { seconds: INVOICE_EXPIRE_SECS })
  const invoice = await createLNDinvoice({
    description: payIn.user?.hideInvoiceDesc ? undefined : await payInTypeModules[payIn.payInType].describe(payIn, payInArgs, { models, me }),
    mtokens: String(mCostRemaining),
    expires_at: expiresAt,
    lnd
  })
  return invoice.request
}

// in the case of a zap getPayOuts will return
async function payInAddInvoice (mCostRemaining, payIn, payInArgs, { models, me }) {
  let bolt11 = null
  let payInState = null
  if (payIn.payOutBolt11) {
    bolt11 = await wrapBolt11({ msats: mCostRemaining, bolt11: payIn.payOutBolt11.bolt11, expiry: INVOICE_EXPIRE_SECS }, { models, me })
    payInState = 'PENDING_HELD'
  } else {
    bolt11 = await createBolt11(mCostRemaining, payIn, payInArgs, { models, me })
    payInState = payIn.pessimisticEnv ? 'PENDING_HELD' : 'PENDING'
  }

  const decodedBolt11 = parsePaymentRequest({ request: bolt11 })
  const expiresAt = new Date(decodedBolt11.expires_at)
  const msatsRequested = BigInt(decodedBolt11.mtokens)

  return await models.payIn.update({
    where: { id: payIn.id, payInState: 'PENDING_INVOICE_CREATION' },
    data: {
      payInState,
      payInStateChangedAt: new Date(),
      payInBolt11: {
        create: {
          hash: decodedBolt11.id,
          bolt11,
          msatsRequested,
          expiresAt
        }
      }
    },
    include: {
      payInBolt11: true
    }
  })
}

export async function onFail (tx, payIn, payInArgs, { me }) {
  const payInModule = payInTypeModules[payIn.payInType]
  // refund the custodial tokens
  for (const payInCustodialToken of payIn.payInCustodialTokens) {
    await tx.$queryRaw`
      UPDATE users
      SET msats = msats + ${payInCustodialToken.custodialTokenType === 'SATS' ? payInCustodialToken.mtokens : 0},
        mcredits = mcredits + ${payInCustodialToken.custodialTokenType === 'CREDITS' ? payInCustodialToken.mtokens : 0}
      WHERE id = ${payIn.userId}`
  }
  await payInModule.onFail(tx, payIn, payInArgs, { me })
}

// maybe if payIn has an invoiceForward associated with it, we can use credits or not
async function onPaid (tx, payIn, payInArgs, { models, me }) {
  const payInModule = payInTypeModules[payIn.payInType]
  const payOuts = await payInModule.getPayOuts(tx, payIn, payInArgs, { me })

  for (const payOut of payOuts) {
    await tx.$queryRaw`
      WITH user AS (
        UPDATE users
        SET msats = msats + ${payOut.custodialTokenType === 'SATS' ? payOut.mtokens : 0},
          mcredits = mcredits + ${payOut.custodialTokenType === 'CREDITS' ? payOut.mtokens : 0}
        FROM (SELECT id, mcredits, msats FROM users WHERE id = ${payOut.userId} FOR UPDATE) before
        WHERE users.id = before.id
        RETURNING mcredits, msats, mcreditsBefore, msatsBefore
      )
      INSERT INTO "payOuts" ("payInId", "payOutType", "mtokens", "custodialTokenType", "msatsBefore", "mcreditsBefore")
      VALUES (${payIn.id}, ${payOut.payOutType}, ${payOut.mtokens}, ${payOut.custodialTokenType}, ${payOut.msatsBefore}, ${payOut.mcreditsBefore})`
  }

  await payInModule.onPaid(tx, payIn, payInArgs, { me })
  // run non critical side effects in the background
  // now that everything is paid
  payInModule.nonCriticalSideEffects?.(payIn, payInArgs, { models, me }).catch(console.error)
}
