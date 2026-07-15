import { Prisma } from '@prisma/client'
import { errorMessage } from '@/lib/error'
import { RECONCILIATION_GRACE_MS } from '@/lib/constants'
import {
  externalTransactionDiagnosticMessage,
  EXTERNAL_TRANSACTION_UNKNOWN_REASONS
} from '@/wallets/lib/external-transactions'
import { walletAmountToMsatsOrUndefined } from '@/wallets/lib/amount'
import { verifyPreimage } from '@/wallets/lib/preimage'
import { protocolHasInvoiceChecker } from '@/wallets/server/protocols/util'
import { truncateToCharLength } from '@/lib/validate'
import { TOR_REGEXP } from '@/lib/url'
import { walletLogger } from './logger'

const EXTERNAL_TX_CHECK_BATCH_SIZE = 25

// Selection, lease renewal, and protocol materialization share one statement.
// The database clock owns the schedule.
export async function claimExternalTransactionChecks (models) {
  return await models.$queryRaw`
    WITH candidates AS (
      SELECT
        "id",
        now() - "created_at" AS age,
        "invoiceExpiresAt" +
          ${RECONCILIATION_GRACE_MS}::bigint * interval '1 millisecond' AS horizon
      FROM "ExternalTransaction"
      WHERE "outcome" IS NULL
        AND "nextCheckAt" <= now()
        AND "bolt11" IS NOT NULL
        AND "hash" IS NOT NULL
        AND "direction" = 'RECEIVE'::"ExternalTransactionDirection"
      ORDER BY "nextCheckAt" ASC, "id" ASC
      LIMIT ${EXTERNAL_TX_CHECK_BATCH_SIZE}
      FOR UPDATE SKIP LOCKED
    ),
    claimed AS (
      UPDATE "ExternalTransaction" AS tx
      SET "nextCheckAt" = CASE
        WHEN candidates.horizon <= now()
          OR candidates.age < interval '3 minutes'
          THEN now() + interval '15 seconds'
        ELSE LEAST(
          candidates.horizon,
          now() + LEAST(
            interval '1 day',
            GREATEST(interval '1 minute', candidates.age / 8)
          )
        )
      END
      FROM candidates
      WHERE tx."id" = candidates."id"
      RETURNING tx.*, tx."created_at" AS "createdAt", tx."updated_at" AS "updatedAt"
    )
    SELECT
      claimed.*,
      jsonb_build_object(
        'name', protocol."name",
        'config', protocol."config"
      ) AS "checkProtocol"
    FROM claimed
    JOIN "WalletProtocol" AS protocol
      ON protocol."id" = claimed."protocolId"
    ORDER BY claimed."id" ASC`
}

export async function createExternalReceiveTransaction (models, args) {
  const { userId, protocol, bolt11, invoice } = args
  const verificationContext = sanitizeVerificationContext(args.verificationContext)
  const hasChecker = protocolHasInvoiceChecker(protocol, { verificationContext })

  const transaction = await models.externalTransaction.create({
    data: {
      bolt11,
      hash: invoice.id,
      amountMsats: invoice.mtokens != null ? BigInt(invoice.mtokens) : null,
      invoiceExpiresAt: new Date(invoice.expires_at),
      direction: 'RECEIVE',
      outcome: hasChecker ? undefined : 'UNKNOWN',
      nextCheckAt: hasChecker ? undefined : null,
      unknownReason: hasChecker
        ? undefined
        : EXTERNAL_TRANSACTION_UNKNOWN_REASONS.VERIFICATION_UNSUPPORTED,
      userId,
      walletId: protocol.walletId,
      protocolId: protocol.id,
      verificationContext: verificationContext ?? Prisma.DbNull
    },
    include: externalTransactionInclude()
  })

  await logExternalTransactionTransition(models, transaction)

  return transaction
}

// An observation either closes reconciliation with an immutable outcome or leaves
// it open (null). Only UNKNOWN persists a structured reason.
function outcomeForObservation (transaction, {
  status,
  preimage,
  msats,
  actualFeeMsats,
  settledAt,
  errorType
} = {}, now = Date.now()) {
  if (status === 'SETTLED') {
    const outcome = { outcome: 'SETTLED' }
    if (preimage && verifyPreimage(transaction.hash, preimage)) {
      outcome.preimage = preimage
    }
    if (settledAt instanceof Date || typeof settledAt === 'string') {
      const date = new Date(settledAt)
      if (Number.isFinite(date.getTime())) outcome.settledAt = date
    }
    const normalizedActualFeeMsats = walletAmountToMsatsOrUndefined(actualFeeMsats)
    if (normalizedActualFeeMsats != null) outcome.actualFeeMsats = normalizedActualFeeMsats
    const normalizedSettledMsats = walletAmountToMsatsOrUndefined(msats)
    if (normalizedSettledMsats != null) outcome.settledMsats = normalizedSettledMsats
    return outcome
  }

  if (status === 'FAILED') return { outcome: 'FAILED' }
  if (status === 'EXPIRED') return { outcome: 'EXPIRED' }

  const unknownReason = [
    EXTERNAL_TRANSACTION_UNKNOWN_REASONS.TRANSIENT_CHECK_FAILED,
    EXTERNAL_TRANSACTION_UNKNOWN_REASONS.PERMISSION_REQUIRED,
    EXTERNAL_TRANSACTION_UNKNOWN_REASONS.VERIFICATION_UNSUPPORTED
  ].includes(errorType)
    ? errorType
    : EXTERNAL_TRANSACTION_UNKNOWN_REASONS.STATUS_UNAVAILABLE
  const reconcileUntil = new Date(transaction.invoiceExpiresAt).getTime() +
    RECONCILIATION_GRACE_MS
  if (unknownReason !== EXTERNAL_TRANSACTION_UNKNOWN_REASONS.VERIFICATION_UNSUPPORTED &&
      now < reconcileUntil) return null
  return { outcome: 'UNKNOWN', unknownReason }
}

export async function recordExternalTransactionObservation (
  models,
  transaction,
  observation
) {
  const outcome = outcomeForObservation(transaction, observation)
  if (!outcome?.outcome || transaction.outcome != null || transaction.nextCheckAt == null) {
    return transaction
  }

  const data = {
    outcome: outcome.outcome,
    nextCheckAt: null,
    unknownReason: outcome.unknownReason ?? null,
    ...(outcome.outcome === 'SETTLED' && {
      preimage: outcome.preimage,
      settledMsats: outcome.settledMsats ?? transaction.amountMsats,
      settledAt: outcome.settledAt ?? null,
      actualFeeMsats: outcome.actualFeeMsats ?? null
    })
  }
  const { count } = await models.externalTransaction.updateMany({
    where: { id: transaction.id, outcome: null },
    data
  })
  if (count === 0) return transaction

  const updated = { ...transaction, ...data }
  await logExternalTransactionTransition(models, updated, {
    detail: observation.detail
  })
  return updated
}

async function logExternalTransactionTransition (models, after, { detail } = {}) {
  if (!after?.outcome) return
  const status = after.outcome
  const providerDetail = detail
    ? truncateToCharLength(errorMessage(detail), 500)
    : undefined
  let log
  if (status === 'SETTLED') {
    log = { method: 'ok', message: 'receive settled' }
  } else if (status === 'FAILED') {
    log = {
      method: 'error',
      message: providerDetail ? `receive failed: ${providerDetail}` : 'receive failed'
    }
  } else if (status === 'EXPIRED') {
    log = { method: 'warn', message: 'receive expired unpaid before settlement could be confirmed' }
  } else {
    log = {
      method: 'warn',
      message: `receive status unknown: ${externalTransactionDiagnosticMessage({ ...after, status })}`,
      context: { unknown_reason: after.unknownReason }
    }
  }
  if (providerDetail && status !== 'FAILED') {
    log.context = { ...log.context, provider_detail: providerDetail }
  }

  await walletLogger({
    models,
    protocolId: after.protocolId,
    userId: after.userId,
    externalTransactionId: after.id
  })[log.method](log.message, log.context)
}

export function externalTransactionInclude () {
  return {
    protocol: {
      include: {
        wallet: {
          include: {
            template: true
          }
        }
      }
    }
  }
}

function sanitizeVerificationContext (value) {
  const url = value?.lnurlVerifyUrl
  if (typeof url !== 'string') return null
  try {
    const parsed = new URL(url)
    const supportedProtocol = parsed.protocol === 'https:' ||
      (parsed.protocol === 'http:' &&
        (process.env.NODE_ENV === 'development' || TOR_REGEXP.test(parsed.hostname)))
    return supportedProtocol ? { lnurlVerifyUrl: parsed.toString() } : null
  } catch {
    return null
  }
}
