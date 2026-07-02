import { Prisma } from '@prisma/client'
import { bolt11ToPayment, bolt11ExpiresAt } from '@/lib/bolt11'
import { GqlInputError } from '@/lib/error'
import { externalTransactionUnknown, externalTransactionVerificationUnsupported, externalTransactionFinal, externalTransactionResolvesLocally, EXPIRY_GRACE_MS, EXTERNAL_TRANSACTION_UNKNOWN_REASONS, MAX_CHECK_AGE_MS, STOP_CHECK_REASONS, TERMINAL_STATUSES } from '@/wallets/lib/external-transactions'
import { verifyPreimage } from '@/wallets/lib/preimage'
import { protocolCanCheckInvoice } from '@/wallets/server/protocols/util'
import { explainSendDuplicateConflict, requireNoRecentSettledLnAddrRepeat } from './external-transaction-duplicates'

const SEND_PREIMAGE_REPAIR_STATUSES = ['PENDING', 'UNKNOWN', 'FAILED']
// statuses covered by the unconfirmed same-hash unique index
// (ExternalTransaction_send_hash_unconfirmed_key)
export const SEND_HASH_UNIQUE_STATUSES = ['PENDING', 'UNKNOWN', 'SETTLED']

// The partial unique indexes are the duplicate guard: insert first, and on
// conflict explain what the database refused.
export async function createExternalSendTransaction (models, args) {
  const protocol = await resolveExternalWalletProtocol(models, args)
  const invoice = parseExternalTransactionBolt11(args.bolt11)
  const source = { userId: args.userId, invoice, sourceType: args.sourceType, sourceValue: args.sourceValue }

  // the unique indexes ignore confirmed rows, so the already-paid block needs a
  // read either way: this invoice's settlement may live on a confirmed row
  const settled = await models.externalTransaction.findFirst({
    where: { userId: args.userId, direction: 'SEND', hash: invoice.hash, settlementStatus: 'SETTLED' },
    select: { id: true }
  })
  if (settled) throw new GqlInputError('invoice already paid in wallet activity')

  if (!args.duplicateConfirmed) {
    await requireNoRecentSettledLnAddrRepeat(models, source)
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await models.externalTransaction.create(
        externalTransactionCreateArgs(args, protocol, invoice, null)
      )
    } catch (err) {
      if (err?.code !== 'P2002') throw err
      // throws the already-paid block or a confirmation prompt; returns
      // { duplicateConfirmed: true } when only stale unresolved rows hold the key
      args = { ...args, ...(await explainSendDuplicateConflict(models, source)) }
    }
  }
  throw new GqlInputError('wallet activity changed while starting send; try the send again')
}

export async function createExternalReceiveTransaction (models, args) {
  const protocol = await resolveExternalWalletProtocol(models, args)
  const invoice = parseExternalTransactionBolt11(args.bolt11)

  // Protocols without status checks get their terminal-intent diagnosis up front.
  const lifecycle = protocolCanCheckInvoice(protocol) ? null : externalTransactionVerificationUnsupported('RECEIVE')
  return await models.externalTransaction.create(
    externalTransactionCreateArgs(args, protocol, invoice, lifecycle)
  )
}

// A watched receive is the only case that needs sub-minute checks: the transaction
// page polls while the row is live, so each read enqueues one. The singleton key
// collapses concurrent pokes and the every-minute reaper covers unwatched rows.
export async function pokeExternalTransactionCheck (models, transaction) {
  if (transaction?.direction !== 'RECEIVE') return
  if (externalTransactionFinal(transaction) && !externalTransactionResolvesLocally(transaction)) return
  // debounce to roughly one check per page poll
  if (new Date(transaction.updatedAt).getTime() > Date.now() - 10_000) return

  await models.$executeRaw`
    INSERT INTO pgboss.job (name, data, singletonkey)
    VALUES ('checkExternalTransaction', jsonb_build_object('id', ${transaction.id}::INTEGER), ${`checkExternalTransaction:${transaction.id}`})
    ON CONFLICT DO NOTHING`
    .catch(err => console.error('failed to poke external wallet transaction check', transaction.id, err))
}

async function resolveExternalWalletProtocol (models, { protocolId, walletId, userId, direction }) {
  const protocol = await models.walletProtocol.findFirst({
    where: {
      id: Number(protocolId),
      walletId: Number(walletId),
      send: direction === 'SEND',
      wallet: { userId }
    },
    select: { id: true, walletId: true, name: true }
  })
  if (!protocol) throw new GqlInputError('wallet protocol not found')
  return protocol
}

function externalTransactionCreateArgs (args, protocol, invoice, lifecycle) {
  lifecycle = lifecycle ?? {}
  return {
    data: {
      ...invoice,
      direction: args.direction,
      settlementStatus: lifecycle.settlementStatus ?? 'PENDING',
      settlementStatusChangedAt: new Date(),
      unknownReason: lifecycle.unknownReason ?? null,
      userId: args.userId,
      walletId: protocol.walletId,
      protocolId: protocol.id,
      sourceType: args.sourceType,
      // BOLT11 sourceValue would duplicate the invoice verbatim and defeat the
      // retention purge; only LN_ADDR uses it (post-drop display + dedupe)
      sourceValue: args.sourceType === 'LN_ADDR' ? args.sourceValue : null,
      duplicateConfirmed: Boolean(args.duplicateConfirmed),
      maxFeeLimitMsats: optionalBigInt(args.maxFeeLimitMsats),
      error: lifecycle.error ?? null,
      // Prisma needs an explicit DbNull to write SQL NULL into a nullable Json column
      verificationContext: args.verificationContext === null ? Prisma.DbNull : args.verificationContext
    },
    include: externalTransactionInclude()
  }
}

export async function updateExternalTransaction (models, { id, userId, ...change }) {
  const tx = await models.externalTransaction.findFirst({
    where: {
      id: Number(id),
      userId
    }
  })
  if (!tx) throw new GqlInputError('external transaction not found')
  if (tx.direction === 'RECEIVE') {
    throw new GqlInputError('external receive transactions are reconciled by the server')
  }

  return await applyExternalTransactionChange(models, tx, change)
}

export async function applyExternalTransactionChange (models, tx, change) {
  // Receives trust provider settlement; sends require proof.
  const hasPreimage = !!change.preimage
  const invalidPreimage = hasPreimage && !verifyPreimage(tx.hash, change.preimage)
  if (change.settlementStatus === 'SETTLED' && (invalidPreimage || !hasPreimage)) {
    const proofError = invalidPreimage ? 'invalid payment preimage' : 'settled external wallet transaction requires proof of payment'
    if (tx.direction === 'SEND') {
      change = externalTransactionUnknown({
        reason: EXTERNAL_TRANSACTION_UNKNOWN_REASONS.PROOF_UNAVAILABLE,
        error: proofError
      })
    } else {
      // Provider-confirmed receive settlement wins; discard unusable proof.
      change = { ...change, preimage: undefined }
    }
  } else if (invalidPreimage) {
    throw new GqlInputError('invalid payment preimage')
  }

  // a send SETTLED change here always carries verified proof: unproven settles
  // were normalized to UNKNOWN above
  if (tx.direction !== 'SEND' || change.settlementStatus !== 'SETTLED') {
    return await writeExternalTransactionChange(models, tx, change)
  }

  // Settle sends inside a serializable transaction, like the create path: the
  // sibling read and the write share one snapshot, so concurrent same-hash
  // settles can't both pass the one-SETTLED-per-hash guard — SSI aborts one
  // writer, and its retry sees the winner and records a FAILED attempt instead.
  try {
    return await retrySerializableSendSettle(models, db => writeExternalTransactionChange(db, tx, change))
  } catch (err) {
    // a unique violation aborts the whole transaction, so diagnose outside it: an
    // unconfirmed same-hash sibling explains the conflict, and the settle is (or
    // will be) recorded on that sibling's row instead
    if (!(await sendSettlementDuplicateExists(models, tx, err))) throw err
    return await currentExternalTransaction(models, tx)
  }
}

async function writeExternalTransactionChange (db, tx, change) {
  // One SETTLED row per (user, hash): after a confirmed "send anyway", both rows'
  // checks resolve to the same underlying payment, so a proof already recorded on
  // a sibling terminalizes this attempt instead of double-counting the spend. For
  // an already-FAILED row this also keeps the preimage repair out (terminal guard
  // below), preserving its original diagnosis.
  if (tx.direction === 'SEND' && change.settlementStatus === 'SETTLED' &&
    await sendHashSiblingExists(db, tx, { settlementStatus: 'SETTLED' })) {
    change = {
      settlementStatus: 'FAILED',
      error: 'payment already recorded by another send of this invoice'
    }
  }

  const { settlementStatus, unknownReason } = change
  const verifiedSendSettlement = tx.direction === 'SEND' && settlementStatus === 'SETTLED'
  const verifiedFailedSendSettlement = verifiedSendSettlement && tx.settlementStatus === 'FAILED'

  // A valid send preimage may repair an earlier FAILED diagnosis from a race.
  if (TERMINAL_STATUSES.has(tx.settlementStatus) && !verifiedFailedSendSettlement) {
    return await currentExternalTransaction(db, tx)
  }

  const now = new Date()
  const settlementStatusChanged = settlementStatus != null && settlementStatus !== tx.settlementStatus
  const unknownStatus = settlementStatus === 'UNKNOWN'
  const nextUnknownReason = unknownStatus
    ? unknownReason ?? tx.unknownReason ?? EXTERNAL_TRANSACTION_UNKNOWN_REASONS.STATUS_UNAVAILABLE
    : undefined

  // Prisma skips undefined and writes null; keep that distinction explicit.
  const data = {
    settlementStatus: settlementStatus ?? undefined,
    settlementStatusChangedAt: settlementStatusChanged ? now : undefined,
    preimage: change.preimage ?? undefined,
    amountMsats: optionalBigInt(change.amountMsats),
    feeMsats: optionalBigInt(change.feeMsats),
    // Settling clears unresolved-state diagnostics.
    error: settlementStatus === 'SETTLED' ? change.error ?? null : change.error,
    // Non-UNKNOWN statuses clear diagnostic fields.
    unknownReason: unknownStatus ? nextUnknownReason : null,
    settledAt: settlementStatus === 'SETTLED' ? change.settledAt ?? now : undefined
  }

  // Compare-and-swap on the status we read so stale pollers no-op.
  const updated = await db.externalTransaction.updateMany({
    where: {
      id: tx.id,
      settlementStatus: tx.settlementStatus
    },
    data
  })
  if (updated.count === 0 && verifiedSendSettlement) {
    // A valid send preimage wins over any unresolved diagnosis written after our read.
    await db.externalTransaction.updateMany({
      where: {
        id: tx.id,
        settlementStatus: { in: SEND_PREIMAGE_REPAIR_STATUSES }
      },
      data
    })
  }

  return await currentExternalTransaction(db, tx)
}

async function retrySerializableSendSettle (models, fn) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await models.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      })
    } catch (err) {
      if (err?.code !== 'P2034' || attempt) throw err
    }
  }
}

function currentExternalTransaction (db, tx) {
  return db.externalTransaction.findUnique({
    where: { id: tx.id },
    include: externalTransactionInclude()
  })
}

// A send-settle write can only violate the unconfirmed same-hash unique index, so
// any unconfirmed sibling the index covers explains the conflict. Skipping the
// write is safe: the payment is (or will be) recorded by a sibling's own check.
async function sendSettlementDuplicateExists (models, tx, err) {
  if (err?.code !== 'P2002') return false
  return await sendHashSiblingExists(models, tx, {
    duplicateConfirmed: false,
    settlementStatus: { in: SEND_HASH_UNIQUE_STATUSES }
  })
}

async function sendHashSiblingExists (models, tx, where) {
  // retention nulls hash on old rows; a null match would hit unrelated rows
  if (!tx.hash) return false
  const sibling = await models.externalTransaction.findFirst({
    where: {
      userId: tx.userId,
      direction: 'SEND',
      hash: tx.hash,
      id: { not: tx.id },
      ...where
    },
    select: { id: true }
  })
  return !!sibling
}

// SQL mirror of externalTransactionCheckStopped: rows whose status can still change.
// PENDING rows are not bounded by the age wall: they stay selectable past their
// polling deadline so they get the one final check that classifies them terminal
// (expired -> FAILED 'invoice expired', or a gave-up UNKNOWN).
export function externalTransactionCheckableWhere ({ now = Date.now(), pending = {}, includeLocallyResolvable = false } = {}) {
  return {
    OR: [
      { settlementStatus: 'PENDING', ...pending },
      {
        settlementStatus: 'UNKNOWN',
        createdAt: { gt: new Date(now - MAX_CHECK_AGE_MS) },
        NOT: { unknownReason: { in: [...STOP_CHECK_REASONS] } },
        // expired-unpaid receives can still terminalize locally
        // (externalTransactionResolvesLocally), so the reaper keeps them
        // selectable; client-polled sends stop at expiry + grace
        ...(includeLocallyResolvable
          ? {}
          : {
              OR: [
                { invoiceExpiresAt: null },
                { invoiceExpiresAt: { gt: new Date(now - EXPIRY_GRACE_MS) } }
              ]
            })
      }
    ]
  }
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

function parseExternalTransactionBolt11 (bolt11) {
  // External receives are display/activity-only, so the shared decoder is enough.
  const { hash, msatsRequested } = bolt11ToPayment(bolt11)
  if (!hash) throw new GqlInputError('could not decode invoice')

  return {
    bolt11,
    hash,
    amountMsats: msatsRequested,
    invoiceExpiresAt: bolt11ExpiresAt(bolt11)
  }
}

// preserves undefined (skip the column) and null (clear it); coerces everything else to BigInt
function optionalBigInt (value) {
  return value == null ? value : BigInt(value)
}
