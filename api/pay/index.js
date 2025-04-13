import { PAID_ACTION_PAYMENT_METHODS, USER_ID } from '@/lib/constants'
import { Prisma } from '@prisma/client'

import * as ITEM_CREATE from './itemCreate'
import * as ITEM_UPDATE from './itemUpdate'
import * as ZAP from './zap'
import * as DOWN_ZAP from './downZap'
import * as POLL_VOTE from './pollVote'
import * as TERRITORY_CREATE from './territoryCreate'
import * as TERRITORY_UPDATE from './territoryUpdate'
import * as TERRITORY_BILLING from './territoryBilling'
import * as TERRITORY_UNARCHIVE from './territoryUnarchive'
import * as DONATE from './donate'
import * as BOOST from './boost'
import * as PROXY_PAYMENT from './receive'
import * as BUY_CREDITS from './buyCredits'
import * as INVITE_GIFT from './inviteGift'

export const payInTypeModules = {
  BUY_CREDITS,
  ITEM_CREATE,
  ITEM_UPDATE,
  ZAP,
  DOWN_ZAP,
  BOOST,
  DONATE,
  POLL_VOTE,
  INVITE_GIFT,
  TERRITORY_CREATE,
  TERRITORY_UPDATE,
  TERRITORY_BILLING,
  TERRITORY_UNARCHIVE,
  PROXY_PAYMENT
  // REWARDS
}

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

export async function payInRetry (payInId, { models, me }) {
  const payIn = await models.payIn.findUnique({ where: { id: payInId, payInState: 'FAILED' } })
  if (!payIn) {
    throw new Error('PayIn not found')
  }
  // TODO: add predecessorId to payInSuccessor
  // if payInFailureReason is INVOICE_CREATION_FAILED, we need to force custodial tokens
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

async function payInPerform (payIn, payInArgs, { me, models }) {
  const payInModule = payInTypeModules[payIn.payInType]

  const payOuts = await payInModule.getPayOuts(models, payIn, payInArgs, { me })
  // if there isn't a custodial token for a payOut, it's a p2p payOut
  const mCostP2P = payOuts.find(payOut => !payOut.custodialTokenType)?.mtokens ?? 0n
  // we deduct the p2p payOut from what can be paid with custodial tokens
  const mCustodialCost = payIn.mcost - mCostP2P

  const result = await models.$transaction(async tx => {
    const payInCustodialTokens = await getPayInCustodialTokens(tx, mCustodialCost, { me, models })
    const mCustodialPaying = payInCustodialTokens.reduce((acc, token) => acc + token.mtokens, 0n)

    // TODO: what if remainingCost < 1000n or not a multiple of 1000n?
    // the remaining cost will be paid with an invoice
    const remainingCost = mCustodialCost - mCustodialPaying + mCostP2P

    const payInResult = await tx.payIn.create({
      data: {
        payInType: payIn.payInType,
        mcost: payIn.mcost,
        payInState: remainingCost > 0n ? 'PENDING_INVOICE_CREATION' : 'PAID',
        payInStateChangedAt: new Date(), // TODO: set with a trigger
        userId: payIn.userId,
        payInCustodialTokens: {
          createMany: {
            data: payInCustodialTokens
          }
        }
      },
      include: {
        payInCustodialTokens: true
      }
    })

    // if it's pessimistic, we don't perform the action until the invoice is held
    if (remainingCost > 0n && (!me || !payInModule.paymentMethods.includes(PAID_ACTION_PAYMENT_METHODS.OPTIMISTIC))) {
      return {
        payIn: payInResult,
        remainingCost
      }
    }

    // if it's optimistic or already paid, we perform the action
    const result = await payInModule.perform(tx, payInResult, payInArgs, { models, me })
    // if there's remaining cost, we return the result but don't run onPaid or payOuts
    if (remainingCost > 0n) {
      // transactionally insert a job to check if the required invoice is added
      // we can't do it before because we don't know the amount of the invoice
      // and we want to refund the custodial tokens if the invoice creation fails
      // TODO: consider timeouts of wrapped invoice creation ... ie 30 seconds might not be enough
      await tx.$executeRaw`INSERT INTO pgboss.job (name, data, startafter, priority)
        VALUES ('checkPayIn', jsonb_build_object('id', ${payInResult.id}::INTEGER), now() + interval '30 seconds', 1000)`
      return {
        payIn: payInResult,
        result,
        remainingCost
      }
    }

    // if it's already paid, we run onPaid and do payOuts in the same transaction
    await onPaid(tx, payInResult, payInArgs, { models, me })
    return {
      payIn: payInResult,
      result,
      remainingCost: 0n
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted })

  if (result.remainingCost > 0n) {
    try {
      let invoice = null
      if (mCostP2P > 0n) {
        // TODO: if creating a p2p invoice fails, we'll want to fallback to paying with custodial tokens or creating a normal invoice
        // I think we'll want to fail the payIn, refund them, then retry with forced custodial tokens
        invoice = await payInAddP2PInvoice(result.remainingCost, result.payIn, payInArgs, { models, me })
      } else {
        invoice = await payInAddInvoice(result.remainingCost, result.payIn, payInArgs, { models, me })
      }
      return {
        payIn: result.payIn,
        result,
        invoice
      }
    } catch (e) {
      // if we fail to add an invoice, we transition the payIn to failed
      models.$executeRaw`INSERT INTO pgboss.job (name, data, startafter, priority)
        VALUES ('payInCancel', jsonb_build_object('id', ${result.payIn.id}::INTEGER), now() + interval '30 seconds', 1000)`.catch(console.error)
      console.error('payInAddInvoice failed', e)
      throw e
    }
  }

  return result.result
}

// in the case of a zap getPayOuts will return
async function payInAddInvoice (remainingCost, payIn, payInArgs, { models, me }) {
  // TODO: add invoice
  return null
}

async function payInAddP2PInvoice (remainingCost, payIn, payInArgs, { models, me }) {
  try {
    // TODO: add p2p invoice
  } catch (e) {
    console.error('payInAddP2PInvoice failed', e)
    try {
      await models.$transaction(async tx => {
        await tx.payIn.update({
          where: { id: payIn.id },
          data: { payInState: 'FAILED', payInFailureReason: 'INVOICE_CREATION_FAILED', payInStateChangedAt: new Date() }
        })
        await onFail(tx, payIn, payInArgs, { models, me })
      })
      // probably need to check if we've timed out already, in which case we should skip the retry
      await payInRetry(payIn.id, { models, me })
    } catch (e) {
      console.error('payInAddP2PInvoice failed to update payIn', e)
    }
  }
  return null
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
