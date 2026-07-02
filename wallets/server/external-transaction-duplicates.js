import { GqlExternalWalletSendConfirmationError, GqlInputError } from '@/lib/error'
import { externalTransactionCheckStopped } from '@/wallets/lib/external-transactions'

const DUPLICATE_LOOKUP_STATUSES = ['PENDING', 'UNKNOWN', 'SETTLED']
// Pinned to the unconfirmed lnaddr unique index by test.
export const UNRESOLVED_SEND_STATUSES = ['PENDING', 'UNKNOWN']
const LN_ADDR_RECENT_REPEAT_MS = 10 * 60 * 1000
// Unresolved duplicates this old stop prompting: polling stops within ~24h
// (externalTransactionPollingDeadline), so a week-old outcome will never confirm
// on its own and warning forever only trains users to click through.
export const UNRESOLVED_PROMPT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

// shared by the hash and LN_ADDR duplicate lookups so they stay in lockstep
const DUPLICATE_ORDER_BY = [
  { settlementStatusChangedAt: 'desc' },
  { createdAt: 'desc' }
]
const DUPLICATE_SELECT = {
  id: true,
  settlementStatus: true,
  hash: true,
  sourceType: true,
  sourceValue: true,
  amountMsats: true,
  createdAt: true,
  settlementStatusChangedAt: true,
  settledAt: true,
  // externalTransactionCheckStopped inputs, so the prompt can distinguish a
  // still-checked duplicate from one whose outcome is permanently unconfirmed
  unknownReason: true,
  invoiceExpiresAt: true
}

// Runs only after the partial unique indexes rejected an insert: look the duplicates
// up and either throw the user-facing explanation, or return the args change that
// makes the retry insertable — { duplicateConfirmed: true } when only stale unresolved
// rows hold the key, {} when the conflicting row resolved since the insert.
export async function explainSendDuplicateConflict (models, { userId, invoice, sourceType, sourceValue }) {
  const hashDuplicates = await models.externalTransaction.findMany({
    where: {
      userId,
      direction: 'SEND',
      settlementStatus: { in: DUPLICATE_LOOKUP_STATUSES },
      hash: invoice.hash
    },
    orderBy: DUPLICATE_ORDER_BY,
    select: DUPLICATE_SELECT
  })
  const duplicates = [
    ...hashDuplicates,
    ...await lnAddrDuplicateLookup(models, { userId, invoice, sourceType, sourceValue })
  ].sort(duplicateOrder)

  const sameHash = tx => tx.hash === invoice.hash
  const sameLnAddr = tx => tx.lnAddrDuplicate || sameLnAddrPayment(tx, invoice, sourceType, sourceValue)

  const settledHashDuplicate = duplicates.find(tx => sameHash(tx) && tx.settlementStatus === 'SETTLED')
  // A settled same-hash match is a hard block; unresolved sends are confirmable.
  // LN_ADDR repeats are separate because each repeat pays a fresh invoice.
  if (settledHashDuplicate) throw new GqlInputError('invoice already paid in wallet activity')

  const promptableUnresolved = tx => {
    if (!UNRESOLVED_SEND_STATUSES.includes(tx.settlementStatus)) return false
    const reference = tx.settlementStatusChangedAt ?? tx.createdAt
    return !reference || Date.now() - new Date(reference).getTime() <= UNRESOLVED_PROMPT_MAX_AGE_MS
  }
  const unresolvedHashDuplicate = duplicates.find(tx => sameHash(tx) && promptableUnresolved(tx))
  if (unresolvedHashDuplicate) {
    throw confirmationRequired(
      externalTransactionCheckStopped(unresolvedHashDuplicate)
        ? 'an earlier payment for this invoice was never confirmed'
        : 'payment may already be in progress',
      unresolvedHashDuplicate, 'PAYMENT_HASH_UNRESOLVED')
  }
  const unresolvedLnAddrDuplicate = duplicates.find(tx => sameLnAddr(tx) && promptableUnresolved(tx))
  if (unresolvedLnAddrDuplicate) {
    throw confirmationRequired(
      externalTransactionCheckStopped(unresolvedLnAddrDuplicate)
        ? 'an earlier payment to this lightning address was never confirmed'
        : 'payment to this lightning address may already be in progress',
      unresolvedLnAddrDuplicate, 'LN_ADDR_UNRESOLVED')
  }

  // the conflicting LN_ADDR row may have settled between the insert and this
  // lookup; the repeat warning still applies before we let a retry through
  await requireNoRecentSettledLnAddrRepeat(models, { userId, invoice, sourceType, sourceValue })

  // only stale unresolved duplicates remain: don't prompt, but confirm the insert
  // so it clears the unique indexes those rows still occupy
  if (duplicates.some(tx => UNRESOLVED_SEND_STATUSES.includes(tx.settlementStatus))) {
    return { duplicateConfirmed: true }
  }
  // the conflicting row resolved between the insert and this lookup; plain retry
  return {}
}

// Advisory, not an invariant: settled repeats are in no unique index, so the
// "you recently sent this amount to this address" prompt needs a read before insert.
export async function requireNoRecentSettledLnAddrRepeat (models, { userId, invoice, sourceType, sourceValue }) {
  if (sourceType !== 'LN_ADDR' || !sourceValue || invoice.amountMsats == null) return
  const recentAfter = new Date(Date.now() - LN_ADDR_RECENT_REPEAT_MS)

  const repeat = await models.externalTransaction.findFirst({
    where: {
      userId,
      direction: 'SEND',
      sourceType: 'LN_ADDR',
      sourceValue: { equals: sourceValue, mode: 'insensitive' },
      amountMsats: invoice.amountMsats,
      settlementStatus: 'SETTLED',
      OR: [
        { settledAt: { gte: recentAfter } },
        { settledAt: null, settlementStatusChangedAt: { gte: recentAfter } }
      ]
    },
    orderBy: DUPLICATE_ORDER_BY,
    select: DUPLICATE_SELECT
  })
  if (repeat) throw confirmationRequired('recent payment to this lightning address already exists', repeat, 'LN_ADDR_RECENT_SETTLED')
}

async function lnAddrDuplicateLookup (models, { userId, invoice, sourceType, sourceValue }) {
  if (sourceType !== 'LN_ADDR' || !sourceValue || invoice.amountMsats == null) return []

  const rows = await models.externalTransaction.findMany({
    where: {
      userId,
      direction: 'SEND',
      sourceType: 'LN_ADDR',
      sourceValue: { equals: sourceValue, mode: 'insensitive' },
      amountMsats: invoice.amountMsats,
      settlementStatus: { in: UNRESOLVED_SEND_STATUSES }
    },
    orderBy: DUPLICATE_ORDER_BY,
    select: DUPLICATE_SELECT
  })

  return rows.map(row => ({ ...row, lnAddrDuplicate: true }))
}

function duplicateOrder (a, b) {
  return compareDateDesc(a.settlementStatusChangedAt, b.settlementStatusChangedAt) ||
    compareDateDesc(a.createdAt, b.createdAt)
}

function compareDateDesc (a, b) {
  return new Date(b ?? 0).getTime() - new Date(a ?? 0).getTime()
}

function sameLnAddrPayment (tx, invoice, sourceType, sourceValue) {
  return sourceType === 'LN_ADDR' &&
    sourceValue &&
    invoice.amountMsats != null &&
    tx.sourceType === 'LN_ADDR' &&
    tx.sourceValue?.toLowerCase() === sourceValue.toLowerCase() &&
    tx.amountMsats === invoice.amountMsats
}

function confirmationRequired (message, transaction, reason) {
  return new GqlExternalWalletSendConfirmationError(message, {
    reason,
    // stopped means the earlier send is permanently unconfirmed, not in flight
    checkStopped: externalTransactionCheckStopped(transaction)
  })
}
