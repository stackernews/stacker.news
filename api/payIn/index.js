import { LND_PATHFINDING_TIME_PREF_PPM, LND_PATHFINDING_TIMEOUT_MS, PAID_ACTION_PAYMENT_METHODS, USER_ID } from '@/lib/constants'
import { Prisma } from '@prisma/client'
import { wrapBolt11 } from '@/wallets/server'
import { createHodlInvoice, createInvoice, parsePaymentRequest, payViaPaymentRequest } from 'ln-service'
import { datePivot } from '@/lib/time'
import lnd from '../lnd'
import payInTypeModules from './types'
import { msatsToSats } from '@/lib/format'

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

async function getPayInCustodialTokens (tx, mCustodialCost, payIn, { me, models }) {
  if (!me || mCustodialCost <= 0n) {
    return []
  }

  const payInAssets = []
  if (isPayableWithCredits(payIn)) {
    const { mcreditsSpent, mcreditsBefore } = await tx.$queryRaw`
      UPDATE users
      SET mcredits = CASE
        WHEN mcredits >= ${mCustodialCost} THEN mcredits - ${mCustodialCost}
        ELSE mcredits - ((mcredits / 1000) * 1000)
      END
      FROM (SELECT id, mcredits FROM users WHERE id = ${me.id} FOR UPDATE) before
      WHERE users.id = before.id
      RETURNING mcredits - before.mcredits as mcreditsSpent, before.mcredits as mcreditsBefore`
    if (mcreditsSpent > 0n) {
      payInAssets.push({
        payInAssetType: 'CREDITS',
        masset: mcreditsSpent,
        massetBefore: mcreditsBefore
      })
    }
    mCustodialCost -= mcreditsSpent
  }

  const { msatsSpent, msatsBefore } = await tx.$queryRaw`
    UPDATE users
    SET msats = CASE
      WHEN msats >= ${mCustodialCost} THEN msats - ${mCustodialCost}
      ELSE msats - ((msats / 1000) * 1000)
    END
    FROM (SELECT id, msats FROM users WHERE id = ${me.id} FOR UPDATE) before
    WHERE users.id = before.id
    RETURNING msats - before.msats as msatsSpent, before.msats as msatsBefore`
  if (msatsSpent > 0n) {
    payInAssets.push({
      payInAssetType: 'SATS',
      masset: msatsSpent,
      massetBefore: msatsBefore
    })
  }

  return payInAssets
}

async function isPessimistic (payIn, { me }) {
  const payInModule = payInTypeModules[payIn.payInType]
  return !me || !payInModule.paymentMethods.includes(PAID_ACTION_PAYMENT_METHODS.OPTIMISTIC)
}

async function isPayableWithCredits (payIn) {
  const payInModule = payInTypeModules[payIn.payInType]
  return payInModule.paymentMethods.includes(PAID_ACTION_PAYMENT_METHODS.FEE_CREDIT)
}

async function isInvoiceable (payIn) {
  const payInModule = payInTypeModules[payIn.payInType]
  return payInModule.paymentMethods.includes(PAID_ACTION_PAYMENT_METHODS.OPTIMISTIC) ||
    payInModule.paymentMethods.includes(PAID_ACTION_PAYMENT_METHODS.PESSIMISTIC) ||
    payInModule.paymentMethods.includes(PAID_ACTION_PAYMENT_METHODS.P2P)
}

async function isP2P (payIn) {
  const payInModule = payInTypeModules[payIn.payInType]
  return payInModule.paymentMethods.includes(PAID_ACTION_PAYMENT_METHODS.P2P)
}

async function isWithdrawal (payIn) {
  return payIn.payInType === 'WITHDRAWAL' || payIn.payInType === 'AUTO_WITHDRAWAL'
}

async function payInPerform (payIn, payInArgs, { me, models }) {
  const payInModule = payInTypeModules[payIn.payInType]

  const { payOutCustodialTokens, payOutBolt11 } = await payInModule.getPayOuts(models, payIn, payInArgs, { me })
  const mP2PCost = isP2P(payIn) ? (payOutBolt11?.msats ?? 0n) : 0n
  const mCustodialCost = payIn.mcost - mP2PCost

  const result = await models.$transaction(async tx => {
    const payInCustodialTokens = await getPayInCustodialTokens(tx, mCustodialCost, payIn, { me, models })
    const mCustodialPaid = payInCustodialTokens.reduce((acc, token) => acc + token.mtokens, 0n)

    const mCostRemaining = mCustodialCost - mCustodialPaid + mP2PCost

    let payInState = null
    if (mCostRemaining > 0n) {
      if (!isInvoiceable(payIn)) {
        throw new Error('Insufficient funds')
      }
      payInState = 'PENDING_INVOICE_CREATION'
    } else if (isWithdrawal(payIn)) {
      payInState = 'PENDING_WITHDRAWAL'
    } else {
      payInState = 'PAID'
    }

    const payInResult = await tx.payIn.create({
      data: {
        payInType: payIn.payInType,
        mcost: payIn.mcost,
        payInState,
        payInStateChangedAt: new Date(),
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
        user: true,
        payOutBolt11: true,
        payOutCustodialTokens: true
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
    const result = await payInModule.perform?.(tx, payInResult.id, payInArgs, { models, me })

    // if it's already paid, we run onPaid and do payOuts in the same transaction
    if (payInResult.payInState === 'PAID') {
      await onPaid(tx, payInResult.id, { models, me })
      // run non critical side effects in the background
      // now that everything is paid
      payInModule.nonCriticalSideEffects?.(payInResult.id, { models }).catch(console.error)
      return {
        payIn: payInResult,
        result,
        mCostRemaining: 0n
      }
    }

    // transactionally insert a job to check if the required invoice/withdrawal is added
    // we can't do it before because we don't know the amount of the invoice
    // and we want to refund the custodial tokens if the invoice creation fails
    // TODO: consider timeouts of wrapped invoice creation ... ie 30 seconds might not be enough
    await tx.$executeRaw`INSERT INTO pgboss.job (name, data, startafter, priority)
        VALUES ('checkPayIn', jsonb_build_object('id', ${payInResult.id}::INTEGER), now() + interval '10 seconds', 1000)`
    return {
      payIn: payInResult,
      result,
      mCostRemaining
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted })

  if (result.payIn.payInState === 'PENDING_INVOICE_CREATION') {
    try {
      return {
        payIn: await payInAddInvoice(result.mCostRemaining, result.payIn, { models, me }),
        result: result.result
      }
    } catch (e) {
      models.$executeRaw`INSERT INTO pgboss.job (name, data, startafter, priority)
        VALUES ('payInFailed', jsonb_build_object('id', ${result.payIn.id}::INTEGER), now(), 1000)`.catch(console.error)
      console.error('payInAddInvoice failed', e)
      throw e
    }
  } else if (result.payIn.payInState === 'PENDING_WITHDRAWAL') {
    const { mtokens } = result.payIn.payOutCustodialTokens.find(t => t.payOutType === 'ROUTING_FEE')
    payViaPaymentRequest({
      lnd,
      request: result.payIn.payOutBolt11.bolt11,
      max_fee: msatsToSats(mtokens),
      pathfinding_timeout: LND_PATHFINDING_TIMEOUT_MS,
      confidence: LND_PATHFINDING_TIME_PREF_PPM
    }).catch(console.error)
  }

  return result.result
}

const INVOICE_EXPIRE_SECS = 600

async function createBolt11 (mCostRemaining, payIn, { models, me }) {
  const createLNDinvoice = payIn.pessimisticEnv ? createHodlInvoice : createInvoice
  const expiresAt = datePivot(new Date(), { seconds: INVOICE_EXPIRE_SECS })
  const invoice = await createLNDinvoice({
    description: payIn.user?.hideInvoiceDesc ? undefined : await payInTypeModules[payIn.payInType].describe(payIn, { models, me }),
    mtokens: String(mCostRemaining),
    expires_at: expiresAt,
    lnd
  })
  return invoice.request
}

// TODO: throw errors that give us PayInFailureReason
async function payInAddInvoice (mCostRemaining, payIn, { models, me }) {
  let bolt11 = null
  let payInState = null
  if (payIn.payOutBolt11) {
    bolt11 = await wrapBolt11({ msats: mCostRemaining, bolt11: payIn.payOutBolt11.bolt11, expiry: INVOICE_EXPIRE_SECS }, { models, me })
    payInState = 'PENDING_HELD'
  } else {
    bolt11 = await createBolt11(mCostRemaining, payIn, { models, me })
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

export async function onFail (tx, payInId, { me }) {
  const payIn = await tx.payIn.findUnique({ where: { id: payInId }, include: { payInCustodialTokens: true } })
  if (!payIn) {
    throw new Error('PayIn not found')
  }

  // refund the custodial tokens
  for (const payInCustodialToken of payIn.payInCustodialTokens) {
    await tx.$queryRaw`
      UPDATE users
      SET msats = msats + ${payInCustodialToken.custodialTokenType === 'SATS' ? payInCustodialToken.mtokens : 0},
        mcredits = mcredits + ${payInCustodialToken.custodialTokenType === 'CREDITS' ? payInCustodialToken.mtokens : 0}
      WHERE id = ${payIn.userId}`
  }
  await payInTypeModules[payIn.payInType].onFail?.(tx, payInId, { me })
}

export async function onPaid (tx, payInId) {
  const payIn = await tx.payIn.findUnique({ where: { id: payInId }, include: { payOutCustodialTokens: true } })
  if (!payIn) {
    throw new Error('PayIn not found')
  }

  for (const payOut of payIn.payOutCustodialTokens) {
    // if the payOut is not for a user, it's a system payOut
    if (!payOut.userId) {
      continue
    }
    await tx.$queryRaw`
      WITH user AS (
        UPDATE users
        SET msats = msats + ${payOut.custodialTokenType === 'SATS' ? payOut.mtokens : 0},
          mcredits = mcredits + ${payOut.custodialTokenType === 'CREDITS' ? payOut.mtokens : 0}
        FROM (SELECT id, mcredits, msats FROM users WHERE id = ${payOut.userId} FOR UPDATE) before
        WHERE users.id = before.id
        RETURNING before.mcredits as mcreditsBefore, before.msats as msatsBefore
      )
      UPDATE "PayOutCustodialToken"
      SET "msatsBefore" = user.msatsBefore, "mcreditsBefore" = user.mcreditsBefore
      FROM user
      WHERE "id" = ${payOut.userId}`
  }

  const payInModule = payInTypeModules[payIn.payInType]
  await payInModule.onPaid?.(tx, payInId)
}
