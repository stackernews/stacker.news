import { Prisma } from '@prisma/client'
import { bolt11ToPayment, bolt11ExpiresAt } from '@/lib/bolt11'
import { GqlInputError } from '@/lib/error'
import { externalTransactionUnknown, externalTransactionUnknownMessage, externalTransactionNextCheckDelayMs, externalTransactionCheckStopped, EXTERNAL_TRANSACTION_UNKNOWN_REASONS, TERMINAL_STATUSES } from '@/wallets/lib/external-transactions'
import { verifyPreimage } from '@/wallets/lib/preimage'
import { protocolCanCheckInvoice } from '@/wallets/server/protocols/util'

// A receive is a plain insert (no prior read, so no transaction needed) and is reconciled later by
// polling the provider, so it's the only path that schedules a status check.
export async function createExternalReceiveTransaction (models, args) {
  const protocol = await resolveExternalWalletProtocol(models, args)
  const invoice = parseExternalTransactionBolt11(args.bolt11)

  // a protocol that can't verify settlement (noffer/CLINK) can never be reconciled by the poller, so
  // record a clean terminal UNKNOWN at create instead of scheduling a doomed PENDING poll
  if (!protocolCanCheckInvoice(protocol)) {
    return await models.externalTransaction.create(
      externalTransactionCreateArgs(args, protocol, invoice, externalTransactionUnknown({
        reason: EXTERNAL_TRANSACTION_UNKNOWN_REASONS.VERIFICATION_UNSUPPORTED,
        error: 'wallet protocol cannot verify invoice status'
      }))
    )
  }

  const settlementStatus = args.settlementStatus ?? 'PENDING'
  const transaction = await models.externalTransaction.create(
    externalTransactionCreateArgs(args, protocol, invoice, { settlementStatus })
  )

  // schedule the first provider status check; each check then re-arms the next until the hot window is
  // spent, after which the every-minute reaper drives the tail (rearm self-guards on stopped/non-pending).
  await rearmExternalTransactionCheck(models, transaction)

  return transaction
}

// schedule the next provider status check for a tx, unless polling has stopped (terminal / stop-reason /
// past deadline) or the hot window is spent — in which case the reaper drives the tail from here.
export async function rearmExternalTransactionCheck (models, transaction) {
  if (!transaction || externalTransactionCheckStopped(transaction)) return
  const delayMs = externalTransactionNextCheckDelayMs(transaction.createdAt)
  if (delayMs == null) return
  await scheduleExternalTransactionCheck(models, transaction.id, new Date(Date.now() + delayMs))
    .catch(err => console.error('failed to schedule external wallet transaction check', transaction.id, err))
}

// low-level enqueue of a provider status check at startAfter (a Date). The singletonkey is keyed on the
// scheduled fire time so each re-arm is unique: a re-arm fires inside the still-active job, so a fixed
// per-tx key would collide with pg-boss's active-job singleton index (exactly what blocked self-re-arm).
async function scheduleExternalTransactionCheck (models, id, startAfter) {
  const singletonKey = `checkExternalTransaction:${id}:${startAfter.getTime()}`
  return models.$executeRaw`
    INSERT INTO pgboss.job (name, data, startafter, priority, singletonkey)
    VALUES ('checkExternalTransaction', jsonb_build_object('id', ${id}::INTEGER), ${startAfter}, 1000, ${singletonKey})`
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
  // lifecycle: { settlementStatus?, unknownReason?, unknownMessage?, error? }.
  // coerce null too (callers may pass an empty/partial lifecycle) so it never derefs null.
  lifecycle = lifecycle ?? {}
  return {
    data: {
      ...invoice,
      direction: args.direction,
      settlementStatus: lifecycle.settlementStatus ?? 'PENDING',
      settlementStatusChangedAt: new Date(),
      unknownReason: lifecycle.unknownReason ?? null,
      unknownMessage: lifecycle.unknownMessage ?? null,
      userId: args.userId,
      walletId: protocol.walletId,
      protocolId: protocol.id,
      sourceType: args.sourceType,
      sourceValue: args.sourceValue,
      maxFeeLimitMsats: optionalBigInt(args.maxFeeLimitMsats),
      error: lifecycle.error ?? args.error,
      verificationContext: jsonInput(args.verificationContext)
    },
    include: externalTransactionInclude()
  }
}

export async function applyExternalTransactionChange (models, tx, change) {
  // Receive status checks trust the user's wallet/provider: if it says the receive settled, mark it
  // settled even when the provider cannot return usable proof. Send settlements still require proof.
  const hasPreimage = !!change.preimage
  const invalidPreimage = hasPreimage && !verifyPreimage(tx.hash, change.preimage)
  if (change.settlementStatus === 'SETTLED' && (invalidPreimage || !hasPreimage)) {
    if (tx.direction === 'SEND') {
      throw new GqlInputError(invalidPreimage ? 'invalid payment preimage' : 'settled external wallet transaction requires proof of payment')
    }
    // provider-confirmed receive settlement wins; never persist an unusable proof value
    change = { ...change, preimage: undefined }
  } else if (invalidPreimage) {
    throw new GqlInputError('invalid payment preimage')
  }

  const { settlementStatus, unknownReason } = change

  // settled/failed rows are terminal and immutable
  if (TERMINAL_STATUSES.has(tx.settlementStatus)) {
    return await models.externalTransaction.findUnique({
      where: { id: tx.id },
      include: externalTransactionInclude()
    })
  }

  const now = new Date()
  const settlementStatusChanged = settlementStatus != null && settlementStatus !== tx.settlementStatus
  const unknownStatus = settlementStatus === 'UNKNOWN'
  const nextUnknownReason = unknownStatus
    ? unknownReason ?? tx.unknownReason ?? EXTERNAL_TRANSACTION_UNKNOWN_REASONS.STATUS_UNAVAILABLE
    : undefined

  // Prisma skips undefined keys (leave the column alone) and writes null (clear it); the coercion
  // helpers preserve that distinction, and preimage is forced to undefined so a stray null can't wipe one.
  const data = {
    settlementStatus: settlementStatus ?? undefined,
    settlementStatusChangedAt: settlementStatusChanged ? now : undefined,
    preimage: change.preimage ?? undefined,
    amountMsats: optionalBigInt(change.amountMsats),
    feeMsats: optionalBigInt(change.feeMsats),
    // settling clears any failure/diagnostic text the row carried while it was unresolved
    error: settlementStatus === 'SETTLED' ? change.error ?? null : change.error,
    // every change carries a settlementStatus, so a non-UNKNOWN status always clears the diagnostic fields
    unknownReason: unknownStatus ? nextUnknownReason : null,
    unknownMessage: unknownStatus ? change.unknownMessage ?? externalTransactionUnknownMessage(nextUnknownReason) : null,
    verificationContext: jsonInput(change.verificationContext),
    settledAt: settlementStatus === 'SETTLED' ? change.settledAt ?? now : undefined
  }

  // compare-and-swap on the status we read: concurrent pollers (per-tx job, batch reaper, client
  // refresh) can race the same row, so a stale writer no-ops instead of clobbering a newer status
  await models.externalTransaction.updateMany({
    where: {
      id: tx.id,
      settlementStatus: tx.settlementStatus
    },
    data
  })

  return await models.externalTransaction.findUnique({
    where: { id: tx.id },
    include: externalTransactionInclude()
  })
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
  // external receives are display/activity-only, so reuse the shared (isomorphic) bolt11 decoder rather
  // than ln-service; the payment path still validates authoritatively via ln-service elsewhere.
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

// Prisma needs an explicit DbNull to write SQL NULL into a nullable Json column
function jsonInput (value) { return value === null ? Prisma.DbNull : value }
