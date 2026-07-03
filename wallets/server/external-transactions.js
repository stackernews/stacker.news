import { Prisma } from '@prisma/client'
import { bolt11ToPayment, bolt11ExpiresAt } from '@/lib/bolt11'
import { GqlInputError } from '@/lib/error'
import { externalTransactionVerificationUnsupported, externalTransactionFinal, externalTransactionResolvesLocally, EXPIRY_GRACE_MS, EXTERNAL_TRANSACTION_UNKNOWN_REASONS, MAX_CHECK_AGE_MS, STOP_CHECK_REASONS, TERMINAL_STATUSES } from '@/wallets/lib/external-transactions'
import { verifyPreimage } from '@/wallets/lib/preimage'
import { protocolCanCheckInvoice } from '@/wallets/server/protocols/util'

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

// Prisma needs an explicit DbNull to write SQL NULL into a nullable Json column
function jsonInput (value) { return value === null ? Prisma.DbNull : value }
