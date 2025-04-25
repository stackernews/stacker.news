import { LND_PATHFINDING_TIME_PREF_PPM, LND_PATHFINDING_TIMEOUT_MS, USER_ID } from '@/lib/constants'
import { Prisma } from '@prisma/client'
import { payViaPaymentRequest } from 'ln-service'
import lnd from '../lnd'
import payInTypeModules from './types'
import { msatsToSats } from '@/lib/format'
import { getCostBreakdown, getPayInCustodialTokens } from './lib/payInCustodialTokens'
import { getPayInBolt11, getPayInBolt11Wrap } from './lib/payInBolt11'
import { isInvoiceable, isPessimistic, isWithdrawal } from './lib/is'
import { payInPrismaCreate } from './lib/payInPrismaCreate'
const PAY_IN_INCLUDE = {
  payInCustodialTokens: true,
  payOutBolt11: true,
  pessimisticEnv: true,
  user: true,
  payOutCustodialTokens: true
}

export default async function payIn (payInType, payInArgs, { models, me }) {
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
    console.error('performPaidAction failed', e)
    throw e
  } finally {
    console.groupEnd()
  }
}

async function begin (models, payInInitial, payInArgs, { me }) {
  const payInModule = payInTypeModules[payInInitial.payInType]
  const { mP2PCost, mCustodialCost } = getCostBreakdown(payInInitial)

  const { payIn, mCostRemaining } = await models.$transaction(async tx => {
    const payInCustodialTokens = await getPayInCustodialTokens(tx, mCustodialCost, payInInitial, { me })
    const mCustodialPaid = payInCustodialTokens.reduce((acc, token) => acc + token.mtokens, 0n)

    // TODO: how to deal with < 1000msats?
    const mCostRemaining = mCustodialCost - mCustodialPaid + mP2PCost

    let payInState = null
    if (mCostRemaining > 0n) {
      if (!isInvoiceable(payInInitial)) {
        throw new Error('Insufficient funds')
      }
      if (mP2PCost > 0n) {
        payInState = 'PENDING_INVOICE_WRAP'
      } else {
        payInState = 'PENDING_INVOICE_CREATION'
      }
    } else if (isWithdrawal(payInInitial)) {
      payInState = 'PENDING_WITHDRAWAL'
    } else {
      payInState = 'PAID'
    }

    const payIn = await tx.payIn.create({
      data: {
        ...payInPrismaCreate({
          ...payInInitial,
          payInState,
          payInStateChangedAt: new Date()
        }),
        pessimisticEnv: {
          create: isPessimistic(payInInitial, { me }) ? { args: payInArgs } : undefined
        }
      },
      include: PAY_IN_INCLUDE
    })

    // if it's pessimistic, we don't perform the action until the invoice is held
    if (payIn.pessimisticEnv) {
      return {
        payIn,
        mCostRemaining
      }
    }

    // if it's optimistic or already paid, we perform the action
    await payInModule.onBegin?.(tx, payIn.id, payInArgs, { models, me })

    // if it's already paid, we run onPaid and do payOuts in the same transaction
    if (payIn.payInState === 'PAID') {
      await onPaid(tx, payIn.id, { me })
      // run non critical side effects
      payInModule.onPaidSideEffects?.(models, payIn.id).catch(console.error)
      return {
        payIn,
        mCostRemaining: 0n
      }
    }

    // TODO: create a periodic job that checks if the invoice/withdrawal creation failed
    // It will need to consider timeouts of wrapped invoice creation very carefully
    return {
      payIn,
      mCostRemaining
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted })

  try {
    return await afterBegin(models, { payIn, mCostRemaining }, payInArgs, { me })
  } catch (e) {
    models.$executeRaw`INSERT INTO pgboss.job (name, data, startafter, priority)
        VALUES ('payInFailed', jsonb_build_object('id', ${payIn.id}::INTEGER), now(), 1000)`.catch(console.error)
    throw e
  }
}

async function afterBegin (models, { payIn, mCostRemaining }, payInArgs, { me }) {
  if (payIn.payInState === 'PENDING_INVOICE_CREATION') {
    const payInBolt11 = await getPayInBolt11(models, { mCostRemaining, payIn }, { me })
    return await models.payIn.update({
      where: { id: payIn.id },
      data: {
        payInState: payIn.pessimisticEnv ? 'PENDING_HELD' : 'PENDING',
        payInStateChangedAt: new Date(),
        payInBolt11: { create: payInBolt11 }
      },
      include: PAY_IN_INCLUDE
    })
  } else if (payIn.payInState === 'PENDING_INVOICE_WRAP') {
    const payInBolt11 = await getPayInBolt11Wrap(models, { mCostRemaining, payIn }, { me })
    return await models.payIn.update({
      where: { id: payIn.id },
      data: {
        payInState: 'PENDING_HELD',
        payInStateChangedAt: new Date(),
        payInBolt11: { create: payInBolt11 }
      },
      include: PAY_IN_INCLUDE
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
    return payIn
  } else {
    throw new Error('Invalid payIn begin state')
  }
}

export async function onFail (tx, payInId) {
  const payIn = await tx.payIn.findUnique({ where: { id: payInId }, include: { payInCustodialTokens: true, beneficiaries: true } })
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

  await payInTypeModules[payIn.payInType].onFail?.(tx, payInId)
  for (const beneficiary of payIn.beneficiaries) {
    await onFail(tx, beneficiary.id)
  }
}

export async function onPaid (tx, payInId) {
  const payIn = await tx.payIn.findUnique({ where: { id: payInId }, include: { payOutCustodialTokens: true, payOutBolt11: true, beneficiaries: true } })
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
          "stackedMsats" = "stackedMsats" + ${!isWithdrawal(payIn) ? payOut.mtokens : 0},
          mcredits = mcredits + ${payOut.custodialTokenType === 'CREDITS' ? payOut.mtokens : 0},
          "stackedMcredits" = "stackedMcredits" + ${!isWithdrawal(payIn) && payOut.custodialTokenType === 'CREDITS' ? payOut.mtokens : 0}
        FROM (SELECT id, mcredits, msats FROM users WHERE id = ${payOut.userId} FOR UPDATE) before
        WHERE users.id = before.id
        RETURNING before.mcredits as mcreditsBefore, before.msats as msatsBefore
      )
      UPDATE "PayOutCustodialToken"
      SET "msatsBefore" = user.msatsBefore, "mcreditsBefore" = user.mcreditsBefore
      FROM user
      WHERE "id" = ${payOut.userId}`
  }

  if (!isWithdrawal(payIn)) {
    if (payIn.payOutBolt11) {
      await tx.$queryRaw`
      UPDATE users
      SET msats = msats + ${payIn.payOutBolt11.msats},
        "stackedMsats" = "stackedMsats" + ${payIn.payOutBolt11.msats}
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
