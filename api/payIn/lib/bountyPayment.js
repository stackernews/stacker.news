export const BOUNTY_ALREADY_PAID_ERROR = 'bounty already paid to this item'
export const BOUNTY_IN_PROGRESS_ERROR = 'bounty payment already in progress for this item'
export const BOUNTY_STALE_RETRY_ERROR = 'bounty payment can only retry the latest failed attempt'

// A bounty "tail" is the latest top-level attempt for an item lineage.
// We prioritize PAID tails to deterministically prevent duplicate payouts.
export async function getBountyPaymentTail (models, itemId) {
  const [tail] = await models.$queryRaw`
    SELECT "PayIn".id, "PayIn"."payInState", "PayIn"."payInFailureReason"
    FROM "ItemPayIn"
    JOIN "PayIn" ON "PayIn".id = "ItemPayIn"."payInId"
    WHERE "ItemPayIn"."itemId" = ${itemId}
    AND "PayIn"."payInType" = 'BOUNTY_PAYMENT'
    AND "PayIn"."successorId" IS NULL
    AND "PayIn"."benefactorId" IS NULL
    ORDER BY
      ("PayIn"."payInState" = 'PAID') DESC,
      ("PayIn"."payInState" <> 'FAILED') DESC,
      "PayIn".id DESC
    LIMIT 1`
  return tail
}

export function getBountyTailBlockError (tail) {
  if (!tail) {
    return null
  }
  if (tail.payInState === 'PAID') {
    return BOUNTY_ALREADY_PAID_ERROR
  }
  return BOUNTY_IN_PROGRESS_ERROR
}
