import { PAID_ACTION_PAYMENT_METHODS } from '@/lib/constants'
import { msatsToSats, satsToMsats, numWithUnits } from '@/lib/format'
import { Prisma } from '@prisma/client'

export const anonable = false

export const paymentMethods = [
  PAID_ACTION_PAYMENT_METHODS.FEE_CREDIT,
  PAID_ACTION_PAYMENT_METHODS.REWARD_SATS,
  PAID_ACTION_PAYMENT_METHODS.OPTIMISTIC
]

export async function getCost (models, { sats }, { me }) {
  return satsToMsats(sats)
}

export async function getPayOuts (models, payIn, { sats, id: itemId }, { me }) {
  const item = await models.item.findUnique({ where: { id: parseInt(itemId) }, include: { sub: true } })

  const revenueMsats = satsToMsats(sats * item.sub.rewardsPct / 100)
  const rewardMsats = satsToMsats(sats - revenueMsats)

  return {
    payOutCustodialTokens: [
      { payOutType: 'REWARDS_POOL', userId: null, mtokens: rewardMsats, custodialTokenType: 'SATS' },
      { payOutType: 'TERRITORY_REVENUE', userId: item.sub.userId, mtokens: revenueMsats, custodialTokenType: 'SATS' }
    ]
  }
}

export async function onPending (tx, payInId, { sats, id: itemId }, { me }) {
  itemId = parseInt(itemId)

  await tx.itemAct.create({
    data: { itemId, payInId }
  })
}

export async function onRetry (tx, oldPayInId, newPayInId) {
  await tx.itemAct.update({ where: { payInId: oldPayInId }, data: { payInId: newPayInId } })
}

export async function onPaid (tx, payInId) {
  const itemAct = await tx.itemAct.findUnique({ where: { payInId }, include: { payIn: true, item: true } })

  const msats = BigInt(itemAct.payIn.mcost)
  const sats = msatsToSats(msats)

  // denormalize downzaps
  await tx.$executeRaw`
    WITH territory AS (
      SELECT COALESCE(r."subName", i."subName", 'meta')::CITEXT as "subName"
      FROM "Item" i
      LEFT JOIN "Item" r ON r.id = i."rootId"
      WHERE i.id = ${itemAct.itemId}::INTEGER
    ), zapper AS (
      SELECT
        COALESCE(${itemAct.item.parentId
          ? Prisma.sql`"zapCommentTrust"`
          : Prisma.sql`"zapPostTrust"`}, 0) as "zapTrust",
        COALESCE(${itemAct.item.parentId
          ? Prisma.sql`"subZapCommentTrust"`
          : Prisma.sql`"subZapPostTrust"`}, 0) as "subZapTrust"
      FROM territory
      LEFT JOIN "UserSubTrust" ust ON ust."subName" = territory."subName"
        AND ust."userId" = ${itemAct.payIn.userId}::INTEGER
    ), zap AS (
      INSERT INTO "ItemUserAgg" ("userId", "itemId", "downZapSats")
      VALUES (${itemAct.payIn.userId}::INTEGER, ${itemAct.itemId}::INTEGER, ${sats}::INTEGER)
      ON CONFLICT ("itemId", "userId") DO UPDATE
      SET "downZapSats" = "ItemUserAgg"."downZapSats" + ${sats}::INTEGER, updated_at = now()
      RETURNING LOG("downZapSats" / GREATEST("downZapSats" - ${sats}::INTEGER, 1)::FLOAT) AS log_sats
    )
    UPDATE "Item"
    SET "weightedDownVotes" = "weightedDownVotes" + zapper."zapTrust" * zap.log_sats,
        "subWeightedDownVotes" = "subWeightedDownVotes" + zapper."subZapTrust" * zap.log_sats
    FROM zap, zapper
    WHERE "Item".id = ${itemAct.itemId}::INTEGER`
}

export async function describe (models, payInId, { me }) {
  const itemAct = await models.itemAct.findUnique({ where: { payInId }, include: { payIn: true, item: true } })
  return `SN: downzap #${itemAct.itemId} for ${numWithUnits(msatsToSats(itemAct.payIn.mcost), { abbreviate: false })}`
}
