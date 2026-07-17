import { GqlExternalWalletSendConfirmationError, GqlInputError } from '@/lib/error'

export const LN_ADDR_RECENT_REPEAT_MS = 60 * 60 * 1000

const PROTECTED_SEND_OUTCOME_WHERE = {
  OR: [
    { outcome: null },
    { outcome: { not: 'FAILED' } }
  ]
}

export async function requireExternalSendConfirmationIfNeeded (models, {
  userId,
  invoice,
  sourceType,
  sourceValue,
  duplicateConfirmed
}) {
  await requireNoConflictingExternalSend(models, {
    userId,
    hash: invoice.hash
  })

  const withdrawal = await models.payOutBolt11.findFirst({
    where: {
      userId,
      hash: invoice.hash,
      OR: [{ status: 'CONFIRMED' }, { status: null }]
    },
    select: { status: true }
  })
  if (withdrawal?.status === 'CONFIRMED') {
    throw new GqlInputError('invoice already paid in wallet activity')
  }
  if (withdrawal) {
    throw new GqlInputError('a withdrawal of this invoice may already be in progress')
  }

  if (duplicateConfirmed ||
    sourceType !== 'LN_ADDR' ||
    !sourceValue ||
    invoice.amountMsats == null) return

  const [recentRepeat] = await models.$queryRaw`
    SELECT "id"
    FROM "ExternalTransaction"
    WHERE "userId" = ${userId}
      AND "direction" = 'SEND'::"ExternalTransactionDirection"
      AND "sourceType" = 'LN_ADDR'::"ExternalTransactionSourceType"
      AND "sourceValue" IS NOT NULL
      AND "amountMsats" IS NOT NULL
      AND lower("sourceValue") = lower(${sourceValue})
      AND "amountMsats" = ${invoice.amountMsats}
      AND "created_at" >= ${new Date(Date.now() - LN_ADDR_RECENT_REPEAT_MS)}
      AND "outcome" IS DISTINCT FROM 'FAILED'::"ExternalTransactionOutcome"
    ORDER BY "created_at" DESC
    LIMIT 1
  `
  if (recentRepeat) {
    throw new GqlExternalWalletSendConfirmationError(
      'You may have already sent this amount to this lightning address within the last hour.'
    )
  }
}

export async function requireNoConflictingExternalSend (models, { userId, hash }) {
  const conflict = await models.externalTransaction.findFirst({
    where: {
      userId,
      direction: 'SEND',
      hash,
      ...PROTECTED_SEND_OUTCOME_WHERE
    },
    select: { outcome: true }
  })
  if (conflict?.outcome === 'SETTLED') {
    throw new GqlInputError('invoice already paid in wallet activity')
  }
  if (conflict) {
    throw new GqlInputError('an external wallet payment for this invoice may already have been sent')
  }
}
