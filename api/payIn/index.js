import { LND_PATHFINDING_TIME_PREF_PPM, LND_PATHFINDING_TIMEOUT_MS, USER_ID } from '@/lib/constants'
import { Prisma } from '@prisma/client'
import { payViaPaymentRequest } from 'ln-service'
import lnd from '../lnd'
import payInTypeModules, { systemOnlyPayIns } from './types'
import { msatsToSats } from '@/lib/format'
import { payInBolt11Prospect, payInBolt11WrapProspect } from './lib/payInBolt11'
import { isPessimistic, isWithdrawal } from './lib/is'
import { PAY_IN_INCLUDE, payInCreate } from './lib/payInCreate'
import { NoReceiveWalletError, payOutBolt11Replacement } from './lib/payOutBolt11'
import { payInClone } from './lib/payInPrisma'
import { createHmac } from '../resolvers/wallet'
import { payOutCustodialTokenFromBolt11 } from './lib/payOutCustodialTokens'

// grab a greedy connection for the payIn system on any server
// if we have lock contention of payIns, we don't want to block other queries
import createPrisma from '@/lib/create-prisma'
const models = createPrisma({ connectionParams: { connection_limit: 1 } })

export default async function pay (payInType, payInArgs, { me }) {
  try {
    const payInModule = payInTypeModules[payInType]

    console.group('payIn', payInType, payInArgs)

    if (!payInModule) {
      throw new Error(`Invalid payIn type ${payInType}`)
    }

    if (!me && !payInModule.anonable) {
      throw new Error('You must be logged in to perform this action')
    }

    me ??= { id: USER_ID.anon }

    const payIn = await payInModule.getInitial(models, payInArgs, { me })
    return await begin(models, payIn, payInArgs, { me })
  } catch (e) {
    console.error('payIn failed', e)
    throw e
  } finally {
    console.groupEnd()
  }
}

export async function paySystemOnly (payInType, payInArgs, { models, me }) {
  try {
    const payInModule = systemOnlyPayIns[payInType]
    console.group('paySystemOnly', payInType, payInArgs)

    if (!payInModule) {
      throw new Error(`Invalid systempayIn type ${payInType}`)
    }

    if (!me) {
      throw new Error('You must specify system payer to perform this action')
    }

    const payIn = await payInModule.getInitial(models, payInArgs, { me })
    return await begin(models, payIn, payInArgs, { me })
  } catch (e) {
    console.error('paySystemOnly failed', e)
    throw e
  } finally {
    console.groupEnd()
  }
}

// we lock all users in the payIn in order to avoid deadlocks with other payIns
// that might be competing to update the same users, e.g. two users simultaneously zapping each other
// https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE
// alternative approaches:
// 1. do NOT lock all users, but use NOWAIT on users locks so that we can catch AND retry transactions that fail with a deadlock error
// 2. issue onPaid in a separate transaction, so that payInCustodialTokens and payOutCustodialTokens cannot be interleaved
async function obtainRowLevelLocks (tx, payIn) {
  const payOutUserIds = [...new Set(payIn.payOutCustodialTokens.map(t => t.userId)).add(payIn.userId)]
  if (payIn.payOutBolt11) {
    payOutUserIds.push(payIn.payOutBolt11.userId)
  }
  await tx.$executeRaw`SELECT * FROM users WHERE id IN (${Prisma.join(payOutUserIds)}) ORDER BY id ASC FOR UPDATE`
}

async function begin (models, payInInitial, payInArgs, { me }) {
  const { payIn, result, mCostRemaining } = await models.$transaction(async tx => {
    await obtainRowLevelLocks(tx, payInInitial)
    const { payIn, mCostRemaining } = await payInCreate(tx, payInInitial, payInArgs, { me })

    // if it's pessimistic, we don't perform the action until the invoice is held
    if (payIn.pessimisticEnv) {
      // we want to double check that the invoice we're assuming will be created is actually created
      await tx.$executeRaw`INSERT INTO pgboss.job (name, data, startafter, priority)
        VALUES ('checkPayInInvoiceCreation', jsonb_build_object('payInId', ${payIn.id}::INTEGER), now() + INTERVAL '30 seconds', 1000)`

      return {
        payIn,
        mCostRemaining
      }
    }

    // if it's optimistic or already paid, we perform the action
    const result = await onBegin(tx, payIn.id, payInArgs)

    // if it's already paid, we run onPaid and do payOuts in the same transaction
    if (payIn.payInState === 'PAID') {
      await onPaid(tx, payIn.id, payInArgs)
      return {
        payIn,
        result,
        mCostRemaining: 0n
      }
    }

    // we want to double check that the invoice we're assuming will be created is actually created
    await tx.$executeRaw`INSERT INTO pgboss.job (name, data, startafter, priority)
      VALUES ('checkPayInInvoiceCreation', jsonb_build_object('payInId', ${payIn.id}::INTEGER), now() + INTERVAL '30 seconds', 1000)`
    return {
      payIn,
      result,
      mCostRemaining
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted })

  return await afterBegin(models, { payIn, result, mCostRemaining }, { me })
}

export async function onBegin (tx, payInId, payInArgs, benefactorResult) {
  const payIn = await tx.payIn.findUnique({ where: { id: payInId }, include: { beneficiaries: true } })
  if (!payIn) {
    throw new Error('PayIn not found')
  }

  const result = await payInTypeModules[payIn.payInType].onBegin?.(tx, payIn.id, payInArgs, benefactorResult)

  for (const beneficiary of payIn.beneficiaries) {
    await onBegin(tx, beneficiary.id, payInArgs, result)
  }

  return result
}

async function afterBegin (models, { payIn, result, mCostRemaining }, { me }) {
  async function afterInvoiceCreation ({ payInState, payInBolt11 }) {
    const updatedPayIn = await models.payIn.update({
      where: {
        id: payIn.id,
        payInState: { in: ['PENDING_INVOICE_CREATION', 'PENDING_INVOICE_WRAP'] }
      },
      data: {
        payInState,
        payInBolt11: {
          create: payInBolt11
        }
      },
      include: PAY_IN_INCLUDE
    })
    // the HMAC is only returned during invoice creation
    // this makes sure that only the person who created this invoice
    // has access to the HMAC
    updatedPayIn.payInBolt11.hmac = createHmac(updatedPayIn.payInBolt11.hash)
    // NOTE: this circular reference is intentional, as it allows us to modify the payIn from the result
    // (e.g. item) in the clientside cache
    return { ...updatedPayIn, result: result ? { ...result, payIn: updatedPayIn } : undefined }
  }

  try {
    if (payIn.payInState === 'PAID') {
      payInTypeModules[payIn.payInType].onPaidSideEffects?.(models, payIn.id).catch(console.error)
    } else if (payIn.payInState === 'PENDING_INVOICE_CREATION') {
      const payInBolt11 = await payInBolt11Prospect(models, payIn,
        { msats: mCostRemaining, description: await payInTypeModules[payIn.payInType].describe(models, payIn.id) })
      return await afterInvoiceCreation({
        payInState: payIn.pessimisticEnv ? 'PENDING_HELD' : 'PENDING',
        payInBolt11
      })
    } else if (payIn.payInState === 'PENDING_INVOICE_WRAP') {
      const payInBolt11 = await payInBolt11WrapProspect(models, payIn,
        { msats: mCostRemaining, description: await payInTypeModules[payIn.payInType].describe(models, payIn.id) })
      return await afterInvoiceCreation({
        payInState: 'PENDING_HELD',
        payInBolt11
      })
    } else if (payIn.payInState === 'PENDING_WITHDRAWAL') {
      const { mtokens } = payIn.payOutCustodialTokens.find(t => t.payOutType === 'ROUTING_FEE')
      payViaPaymentRequest({
        lnd,
        request: payIn.payOutBolt11.bolt11,
        max_fee: msatsToSats(mtokens),
        pathfinding_timeout: LND_PATHFINDING_TIMEOUT_MS,
        confidence: LND_PATHFINDING_TIME_PREF_PPM
      }).catch(console.error)
    } else {
      throw new Error('Invalid payIn begin state')
    }
  } catch (e) {
    models.$executeRaw`INSERT INTO pgboss.job (name, data, startafter, priority)
        VALUES (
          'payInFailed',
          jsonb_build_object(
            'payInId', ${payIn.id}::INTEGER,
            'payInFailureReason', ${e.payInFailureReason ?? 'EXECUTION_FAILED'}),
          now(), 1000)`.catch(console.error)
    throw e
  }

  return { ...payIn, result: result ? { ...result, payIn } : undefined }
}

// NOTE: I considered using Promise.all within these onFail and onPaid txs to avoid round trips to the database, but
// prisma does not support pipelining this way (or any other way afaict), but a lot of the
// deadlock and timeout risks of these interactive txs would be helped by such a thing
export async function onFail (tx, payInId) {
  const payIn = await tx.payIn.findUnique({ where: { id: payInId }, include: { payInCustodialTokens: true, beneficiaries: true } })
  if (!payIn) {
    throw new Error('PayIn not found')
  }

  // refund the custodial tokens
  for (const payInCustodialToken of payIn.payInCustodialTokens) {
    const isSats = payInCustodialToken.custodialTokenType === 'SATS'
    await tx.$executeRaw`
      WITH refunduser AS (
        UPDATE users
        SET msats = msats + ${isSats ? payInCustodialToken.mtokens : 0},
          mcredits = mcredits + ${!isSats ? payInCustodialToken.mtokens : 0}
        WHERE id = ${payIn.userId}
        RETURNING mcredits as "mcreditsAfter", msats as "msatsAfter"
      )
      INSERT INTO "RefundCustodialToken" ("payInId", "mtokens", "mtokensAfter", "custodialTokenType")
      SELECT ${payIn.id}, ${payInCustodialToken.mtokens}, ${isSats ? Prisma.sql`refunduser."msatsAfter"` : Prisma.sql`refunduser."mcreditsAfter"`}, ${payInCustodialToken.custodialTokenType}::"CustodialTokenType"
      FROM refunduser`
  }

  await payInTypeModules[payIn.payInType].onFail?.(tx, payInId)
  for (const beneficiary of payIn.beneficiaries) {
    await onFail(tx, beneficiary.id)
  }
}

export async function onPaid (tx, payInId) {
  const payIn = await tx.payIn.findUnique({
    where: { id: payInId },
    include: {
      payOutBolt11: true,
      beneficiaries: true
    }
  })
  if (!payIn) {
    throw new Error('PayIn not found')
  }

  await obtainRowLevelLocks(tx, payIn)

  // Batch all payOut updates into a single query
  // Each payOut gets sequential mtokensAfter using running totals
  // payouts are unbounded,may be very numerous, e.g. rewards, so we only want one roundtrip to the database
  await tx.$executeRaw`
    WITH payouts_with_running_totals AS (
      SELECT
        id,
        "userId",
        "custodialTokenType",
        mtokens,
        SUM(CASE WHEN "custodialTokenType" = 'SATS' THEN mtokens ELSE 0 END)
          OVER (PARTITION BY "userId" ORDER BY id) as running_sats,
        SUM(CASE WHEN "custodialTokenType" = 'CREDITS' THEN mtokens ELSE 0 END)
          OVER (PARTITION BY "userId" ORDER BY id) as running_credits
      FROM "PayOutCustodialToken"
      WHERE "payInId" = ${payIn.id}
    ),
    user_totals AS (
      SELECT
        "userId",
        SUM(CASE WHEN "custodialTokenType" = 'SATS' THEN mtokens ELSE 0 END) as final_sats,
        SUM(CASE WHEN "custodialTokenType" = 'CREDITS' THEN mtokens ELSE 0 END) as final_credits,
        SUM(mtokens) as final_total
      FROM "PayOutCustodialToken"
      WHERE "payInId" = ${payIn.id}
      GROUP BY "userId"
    ),
    outuser AS (
      UPDATE users
      SET
        msats = users.msats + ut.final_sats,
        "stackedMsats" = users."stackedMsats" + ${isWithdrawal(payIn) ? 0 : Prisma.sql`ut.final_sats`},
        mcredits = users.mcredits + ut.final_credits,
        "stackedMcredits" = users."stackedMcredits" + ${isWithdrawal(payIn) ? 0 : Prisma.sql`ut.final_credits`}
      FROM user_totals ut
      WHERE users.id = ut."userId"
      RETURNING users.id, users.mcredits, users.msats
    )
    UPDATE "PayOutCustodialToken" pct
    SET "mtokensAfter" = CASE
      WHEN pct."custodialTokenType" = 'SATS'
        THEN outuser.msats - ut.final_sats + p.running_sats
      ELSE outuser.mcredits - ut.final_credits + p.running_credits
    END
    FROM payouts_with_running_totals p
    JOIN user_totals ut ON ut."userId" = p."userId"
    JOIN outuser ON outuser.id = p."userId"
    WHERE pct.id = p.id`

  if (!isWithdrawal(payIn)) {
    if (payIn.payOutBolt11) {
      await tx.$executeRaw`
        UPDATE users
        SET "stackedMsats" = "stackedMsats" + ${payIn.payOutBolt11.msats}
        WHERE id = ${payIn.payOutBolt11.userId}`
    }

    // most paid actions are eligible for a cowboy hat streak
    await tx.$executeRaw`
      INSERT INTO pgboss.job (name, data)
      VALUES ('checkStreak', jsonb_build_object('id', ${payIn.userId}, 'type', 'COWBOY_HAT'))`
  }

  const payInModule = payInTypeModules[payIn.payInType]
  await payInModule.onPaid?.(tx, payInId)
  for (const beneficiary of payIn.beneficiaries) {
    await onPaid(tx, beneficiary.id)
  }
}

export async function onPaidSideEffects (models, payInId) {
  const payIn = await models.payIn.findUnique({ where: { id: payInId }, include: { beneficiaries: true } })
  if (!payIn) {
    throw new Error('PayIn not found')
  }

  await payInTypeModules[payIn.payInType].onPaidSideEffects?.(models, payInId)
  for (const beneficiary of payIn.beneficiaries) {
    await onPaidSideEffects(models, beneficiary.id)
  }
}

export async function retry (payInId, { me }) {
  try {
    const include = { payOutCustodialTokens: true, payOutBolt11: true, subPayIn: true, itemPayIn: true, uploadPayIns: true }
    const where = { id: payInId, userId: me.id, payInState: 'FAILED', successorId: null, benefactorId: null }

    const payInFailed = await models.payIn.findFirst({
      where,
      include: { ...include, beneficiaries: { include } }
    })
    if (!payInFailed) {
      throw new Error('PayIn with id ' + payInId + ' not found')
    }
    if (isWithdrawal(payInFailed)) {
      throw new Error('Withdrawal payIns cannot be retried')
    }
    if (isPessimistic(payInFailed, { me })) {
      throw new Error('Pessimistic payIns cannot be retried')
    }

    let payOutBolt11
    if (payInFailed.payOutBolt11) {
      try {
        payOutBolt11 = await payOutBolt11Replacement(models, payInFailed.genesisId ?? payInFailed.id, payInFailed.payOutBolt11)
      } catch (e) {
        console.error('payOutBolt11Replacement failed', e)
        if (!(e instanceof NoReceiveWalletError)) {
          throw e
        }
        // if we can no longer produce a payOutBolt11, we fallback to custodial tokens
        payInFailed.payOutCustodialTokens.push(payOutCustodialTokenFromBolt11(payInFailed.payOutBolt11))
        payInFailed.payOutBolt11 = null
      }
    }

    const { payIn, result, mCostRemaining } = await models.$transaction(async tx => {
      const payInInitial = { ...payInClone({ ...payInFailed, payOutBolt11 }), retryCount: payInFailed.retryCount + 1 }
      await obtainRowLevelLocks(tx, payInInitial)
      const { payIn, mCostRemaining } = await payInCreate(tx, payInInitial, undefined, { me })

      // use an optimistic lock on successorId on the payIn
      const rows = await tx.$queryRaw`UPDATE "PayIn" SET "successorId" = ${payIn.id} WHERE "id" = ${payInFailed.id} AND "successorId" IS NULL RETURNING id`
      if (rows.length === 0) {
        throw new Error('PayIn with id ' + payInFailed.id + ' is already being retried')
      }

      // run the onRetry hook for the payIn and its beneficiaries
      const result = await payInTypeModules[payIn.payInType].onRetry?.(tx, payInFailed.id, payIn.id)
      for (const beneficiary of payIn.beneficiaries) {
        await payInTypeModules[beneficiary.payInType].onRetry?.(tx, beneficiary.id, payIn.id)
      }

      // if it's already paid, we run onPaid and do payOuts in the same transaction
      if (payIn.payInState === 'PAID') {
        await onPaid(tx, payIn.id, { me })
        return {
          payIn,
          result,
          mCostRemaining: 0n
        }
      }

      await tx.$executeRaw`INSERT INTO pgboss.job (name, data, startafter, priority)
        VALUES ('checkPayInInvoiceCreation', jsonb_build_object('payInId', ${payIn.id}::INTEGER), now() + INTERVAL '30 seconds', 1000)`

      return {
        payIn,
        result,
        mCostRemaining
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted })

    return await afterBegin(models, { payIn, result, mCostRemaining }, { me })
  } catch (e) {
    console.error('retry failed', e)
    throw e
  }
}
