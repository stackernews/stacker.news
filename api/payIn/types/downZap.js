import { PAID_ACTION_PAYMENT_METHODS } from '@/lib/constants'
import { msatsToSats, satsToMsats, numWithUnits } from '@/lib/format'
import { Prisma } from '@prisma/client'
import { getItemResult, getSub } from '../lib/item'
import { getRedistributedPayOutCustodialTokens } from '../lib/payOutCustodialTokens'

export const anonable = false

export const paymentMethods = [
  PAID_ACTION_PAYMENT_METHODS.FEE_CREDIT,
  PAID_ACTION_PAYMENT_METHODS.REWARD_SATS,
  PAID_ACTION_PAYMENT_METHODS.OPTIMISTIC
]

export async function getInitial (models, { sats, id: itemId }, { me }) {
  const item = await models.item.findUnique({ where: { id: parseInt(itemId) } })
  const sub = await getSub(models, { subName: item.subName, parentId: item.parentId })

  const mcost = satsToMsats(sats)
  const payOutCustodialTokens = getRedistributedPayOutCustodialTokens({ sub, mcost })

  return {
    payInType: 'DOWN_ZAP',
    userId: me?.id,
    mcost,
    itemPayIn: {
      itemId: parseInt(itemId)
    },
    payOutCustodialTokens
  }
}

export async function onRetry (tx, oldPayInId, newPayInId) {
  const { item, payIn } = await tx.itemPayIn.findUnique({ where: { payInId: oldPayInId }, include: { payIn: true, item: true } })
  await tx.itemPayIn.create({ data: { itemId: item.id, payInId: newPayInId } })
  return { id: item.id, path: item.path, sats: msatsToSats(payIn.mcost), act: 'DONT_LIKE_THIS' }
}

export async function onBegin (tx, payInId, payInArgs) {
  const item = await getItemResult(tx, { id: payInArgs.id })
  return { id: item.id, path: item.path, sats: payInArgs.sats, act: 'DONT_LIKE_THIS' }
}

export async function onPaid (tx, payInId) {
  const payIn = await tx.payIn.findUnique({
    where: { id: payInId },
    include: {
      itemPayIn: { include: { item: true } },
      payOutBolt11: true
    }
  })

  const msats = payIn.mcost
  const sats = msatsToSats(msats)
  const userId = payIn.userId
  const item = payIn.itemPayIn.item

  // denormalize downzaps
  await tx.$executeRaw`
    WITH territory AS (
      SELECT COALESCE(r."subName", i."subName", 'meta')::CITEXT as "subName"
      FROM "Item" i
      LEFT JOIN "Item" r ON r.id = i."rootId"
      WHERE i.id = ${item.id}::INTEGER
    ), zapper AS (
      SELECT
        COALESCE(${item.parentId
          ? Prisma.sql`"zapCommentTrust"`
          : Prisma.sql`"zapPostTrust"`}, 0) as "zapTrust",
        COALESCE(${item.parentId
          ? Prisma.sql`"subZapCommentTrust"`
          : Prisma.sql`"subZapPostTrust"`}, 0) as "subZapTrust"
      FROM territory
      LEFT JOIN "UserSubTrust" ust ON ust."subName" = territory."subName"
        AND ust."userId" = ${userId}::INTEGER
    ), zap AS (
      INSERT INTO "ItemUserAgg" ("userId", "itemId", "downZapSats")
      VALUES (${userId}::INTEGER, ${item.id}::INTEGER, ${sats}::INTEGER)
      ON CONFLICT ("itemId", "userId") DO UPDATE
      SET "downZapSats" = "ItemUserAgg"."downZapSats" + ${sats}::INTEGER, updated_at = now()
      RETURNING LOG("downZapSats" / GREATEST("downZapSats" - ${sats}::INTEGER, 1)::FLOAT) AS log_sats
    )
    UPDATE "Item"
    SET "weightedDownVotes" = "weightedDownVotes" + zapper."zapTrust" * zap.log_sats,
        "subWeightedDownVotes" = "subWeightedDownVotes" + zapper."subZapTrust" * zap.log_sats
    FROM zap, zapper
    WHERE "Item".id = ${item.id}::INTEGER`
}

export async function describe (models, payInId) {
  const payIn = await models.payIn.findUnique({ where: { id: payInId }, include: { itemPayIn: true } })
  return `SN: downzap #${payIn.itemPayIn.itemId} for ${numWithUnits(msatsToSats(payIn.mcost), { abbreviate: false })}`
}
