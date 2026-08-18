import { Prisma } from '@prisma/client'
import { bolt11ExpiresAt, bolt11ToPayment } from '@/lib/bolt11'
import { E_TRANSIENT, errorMessage, GqlInputError } from '@/lib/error'
import {
  RECONCILIATION_GRACE_MS,
  WALLET_EXTERNAL_SEND_POLL_AFTER_MS,
  WALLET_EXTERNAL_TX_CHECK_TIMEOUT_MS
} from '@/lib/constants'
import { withTimeoutSignal } from '@/lib/time'
import {
  toExternalTransactionObservation,
  externalTransactionDiagnosticMessage,
  EXTERNAL_TRANSACTION_UNKNOWN_REASONS
} from '@/wallets/lib/external-transactions'
import { walletAmountToMsatsOrUndefined } from '@/wallets/lib/amount'
import { verifyPreimage } from '@/wallets/lib/preimage'
import { protocolHasInvoiceChecker } from '@/wallets/server/protocols/util'
import { checkLnurlVerifyInvoice } from '@/wallets/server/protocols/lnurlVerify'
import { truncateToCharLength } from '@/lib/validate'
import { TOR_REGEXP } from '@/lib/url'
import { walletLogger } from './logger'
import { requireExternalSendConfirmationIfNeeded } from './external-transaction-duplicates'
import { notifyDeposit } from '@/lib/webPush'

const EXTERNAL_TX_CHECK_BATCH_SIZE = 25

export async function claimExternalTransactionChecks (models) {
  return await claimExternalTransactions(models, Prisma.sql`
    (
      "direction" = 'RECEIVE'::"ExternalTransactionDirection"
      OR (
        "direction" = 'SEND'::"ExternalTransactionDirection"
        AND "invoiceExpiresAt" +
          ${RECONCILIATION_GRACE_MS}::bigint * interval '1 millisecond' <= now()
      )
    )
  `, Prisma.sql`
    SELECT
      claimed.*,
      claimed."verificationContext"->>'providerRequestId' AS "providerRequestId",
      jsonb_build_object(
        'name', protocol."name",
        'config', protocol."config"
      ) AS "checkProtocol"
    FROM claimed
    JOIN "WalletProtocol" AS protocol
      ON protocol."id" = claimed."protocolId"
    ORDER BY claimed."id" ASC
  `)
}

export async function claimDueExternalSendChecks (models, {
  userId
}) {
  return await claimExternalTransactions(models, Prisma.sql`
    "userId" = ${userId}
    AND "direction" = 'SEND'::"ExternalTransactionDirection"
    AND "invoiceExpiresAt" +
      ${RECONCILIATION_GRACE_MS}::bigint * interval '1 millisecond' > now()
  `, Prisma.sql`
    SELECT claimed.*
    FROM claimed
    ORDER BY claimed."id" ASC
  `)
}

// Selection and lease renewal share one statement. The database clock owns the
// schedule; each caller selects only the data it consumes.
async function claimExternalTransactions (models, predicate, selection) {
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
        AND (${predicate})
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
    ${selection}`
}

export async function createExternalSendTransaction (models, args) {
  const { hash, msatsRequested: amountMsats } = bolt11ToPayment(args.bolt11)
  const invoiceExpiresAt = bolt11ExpiresAt(args.bolt11)
  if (!hash || !invoiceExpiresAt) {
    throw new GqlInputError('could not decode invoice')
  }
  const invoice = { bolt11: args.bolt11, hash, amountMsats, invoiceExpiresAt }
  const sourceValue = args.sourceType === 'LN_ADDR' && args.sourceValue
    ? truncateToCharLength(args.sourceValue, 320)
    : null
  const lnurlVerifyUrl = args.sourceType === 'LN_ADDR'
    ? sanitizeLnurlVerifyUrl(args.lnurlVerifyUrl)
    : null

  return await retrySerializableSend(models, async db => {
    const protocol = await db.walletProtocol.findFirst({
      where: {
        id: Number(args.protocolId),
        walletId: Number(args.walletId),
        send: true,
        wallet: { userId: args.userId }
      },
      select: { id: true, walletId: true }
    })
    if (!protocol) throw new GqlInputError('wallet protocol not found')
    await requireExternalSendConfirmationIfNeeded(db, {
      userId: args.userId,
      invoice,
      sourceType: args.sourceType,
      sourceValue,
      duplicateConfirmed: args.duplicateConfirmed
    })
    return await db.externalTransaction.create({
      data: {
        ...invoice,
        direction: 'SEND',
        nextCheckAt: new Date(Date.now() + WALLET_EXTERNAL_SEND_POLL_AFTER_MS),
        userId: args.userId,
        walletId: protocol.walletId,
        protocolId: protocol.id,
        sourceType: args.sourceType ?? 'BOLT11',
        sourceValue,
        maxFeeLimitMsats: args.maxFeeLimitMsats == null
          ? args.maxFeeLimitMsats
          : BigInt(args.maxFeeLimitMsats),
        verificationContext: lnurlVerifyUrl ? { lnurlVerifyUrl } : Prisma.DbNull
      }
    })
  }, 2)
}

async function retrySerializableSend (models, fn, attempts) {
  const retryCodes = ['P2034', 'P2002', 'P2028']
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await models.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      })
    } catch (err) {
      if (!retryCodes.includes(err?.code)) throw err
    }
  }
  throw new GqlInputError(
    'wallet activity changed while starting send; try the send again',
    E_TRANSIENT
  )
}

export async function createExternalReceiveTransaction (models, args) {
  const { userId, protocol, bolt11, invoice } = args
  const lnurlVerifyUrl = sanitizeLnurlVerifyUrl(args.lnurlVerifyUrl)
  const providerRequestId = sanitizeProviderRequestId(args.providerRequestId)
  const sourceValue = args.sourceType === 'LN_ADDR' && args.sourceValue
    ? truncateToCharLength(args.sourceValue, 320)
    : null
  const verificationContext = {
    ...(lnurlVerifyUrl && { lnurlVerifyUrl }),
    ...(providerRequestId && { providerRequestId })
  }
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
      sourceType: args.sourceType ?? null,
      sourceValue,
      verificationContext: Object.keys(verificationContext).length > 0 ? verificationContext : Prisma.DbNull,
      lud18Data: args.lud18Data ? { create: args.lud18Data } : undefined,
      nostrNote: args.note
        ? { create: { note: args.note, rawRequest: args.descriptionHashPreimage } }
        : undefined,
      comment: args.comment ? { create: { comment: args.comment } } : undefined
    }
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
    if (transaction.direction !== 'SEND') {
      const normalizedSettledMsats = walletAmountToMsatsOrUndefined(msats)
      if (normalizedSettledMsats != null) outcome.settledMsats = normalizedSettledMsats
    }
    return outcome
  }

  if (status === 'FAILED') return { outcome: 'FAILED' }
  if (status === 'EXPIRED' && transaction.direction !== 'SEND') {
    return { outcome: 'EXPIRED' }
  }

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

export async function acceptClientExternalSendObservation (models, {
  id,
  userId,
  providerRequestId,
  ...observation
}) {
  let transaction = await models.externalTransaction.findFirst({
    where: { id, userId },
    include: { protocol: { select: { name: true } } }
  })
  if (!transaction) throw new GqlInputError('external transaction not found')
  if (transaction.direction !== 'SEND') {
    throw new GqlInputError('external receive transactions are reconciled by the server')
  }
  // Outcomes are first-write-wins. Consume later facts so durable clients stop replaying them.
  if (transaction.outcome != null) return true

  const requestId = transaction.protocol.name === 'SPARK'
    ? sanitizeProviderRequestId(providerRequestId)
    : null
  if (requestId) {
    const verificationContext = {
      ...transaction.verificationContext,
      providerRequestId: requestId
    }
    const { count } = await models.externalTransaction.updateMany({
      where: { id: transaction.id, outcome: null },
      data: { verificationContext }
    })
    if (count === 0) return true
    transaction = { ...transaction, verificationContext }
  }

  const needsLnurlCheck = transaction.verificationContext?.lnurlVerifyUrl &&
    (observation.status === 'UNKNOWN' ||
      observation.errorType ||
      (observation.status === 'SETTLED' &&
        !verifyPreimage(transaction.hash, observation.preimage)))

  if (needsLnurlCheck) {
    try {
      const verificationResult = await withTimeoutSignal(
        WALLET_EXTERNAL_TX_CHECK_TIMEOUT_MS,
        signal => checkLnurlVerifyInvoice(transaction, null, { signal })
      )
      observation = observation.status === 'SETTLED'
        ? {
            ...observation,
            preimage: verificationResult?.preimage ?? observation.preimage
          }
        : toExternalTransactionObservation({
          ...verificationResult,
          detail: verificationResult?.detail ?? observation.detail
        })
    } catch (err) {
      if (observation.status !== 'SETTLED') {
        observation = toExternalTransactionObservation(
          { ...observation, errorType: undefined },
          { error: err }
        )
      }
    }
  }

  await recordExternalTransactionObservation(
    models,
    transaction,
    observation
  )
  return true
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
  const result = await models.$transaction(async tx => {
    const { count } = await tx.externalTransaction.updateMany({
      where: { id: transaction.id, outcome: null },
      data
    })
    if (count === 0) return null

    const updated = { ...transaction, ...data }
    let metadata
    if (updated.direction === 'RECEIVE' && updated.outcome === 'SETTLED') {
      metadata = await tx.externalTransaction.findUnique({
        where: { id: updated.id },
        include: { comment: true, nostrNote: true }
      })

      if (metadata?.nostrNote && updated.preimage) {
        await tx.$executeRaw`
          INSERT INTO pgboss.job (name, data)
          VALUES ('nip57', jsonb_build_object('hash', ${updated.hash}))`
      }
    }

    return { updated, metadata }
  })
  if (!result) return transaction

  const { updated, metadata } = result
  await logExternalTransactionTransition(models, updated, {
    detail: observation.detail
  })
  await externalReceiveSettledSideEffects(updated, metadata)
  return updated
}

async function externalReceiveSettledSideEffects (transaction, metadata) {
  if (transaction.direction !== 'RECEIVE' || transaction.outcome !== 'SETTLED') return

  await notifyDeposit(transaction.userId, {
    msatsReceived: transaction.settledMsats ?? transaction.amountMsats,
    comment: metadata?.comment?.comment
  })
}

async function logExternalTransactionTransition (models, after, { detail } = {}) {
  if (!after?.outcome) return
  const status = after.outcome
  const direction = after.direction === 'SEND' ? 'send' : 'receive'
  const providerDetail = detail
    ? truncateToCharLength(errorMessage(detail), 500)
    : undefined
  let log
  if (status === 'SETTLED') {
    log = after.direction === 'SEND' && !after.preimage
      ? {
          method: 'warn',
          message: 'send settled without matching proof',
          context: { proof_unavailable: true }
        }
      : { method: 'ok', message: `${direction} settled` }
  } else if (status === 'FAILED') {
    log = {
      method: 'error',
      message: providerDetail ? `${direction} failed: ${providerDetail}` : `${direction} failed`
    }
  } else if (status === 'EXPIRED') {
    log = { method: 'warn', message: 'receive expired unpaid before settlement could be confirmed' }
  } else {
    log = {
      method: 'warn',
      message: `${direction} status unknown: ${externalTransactionDiagnosticMessage({ ...after, status })}`,
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

export const EXTERNAL_TRANSACTION_INCLUDE = {
  lud18Data: true,
  nostrNote: true,
  comment: true,
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

function sanitizeLnurlVerifyUrl (value) {
  if (typeof value !== 'string') return null
  try {
    const parsed = new URL(value)
    const supportedProtocol = parsed.protocol === 'https:' ||
      (parsed.protocol === 'http:' &&
        (process.env.NODE_ENV === 'development' || TOR_REGEXP.test(parsed.hostname)))
    return supportedProtocol ? parsed.toString() : null
  } catch {
    return null
  }
}

function sanitizeProviderRequestId (value) {
  if (typeof value !== 'string') return null
  return truncateToCharLength(value.trim(), 256) || null
}
