export const LEDGER_TYPE = Object.freeze({
  OBLIGATION: 'OBLIGATION',
  FULFILLMENT: 'FULFILLMENT',
  UNKNOWN: 'UNKNOWN',
  ERROR: 'ERROR',
  TIMEOUT: 'TIMEOUT',
  CORRECTION: 'CORRECTION'
})

export const LEDGER_SIDE = Object.freeze({
  DEBIT: 'DEBIT',
  CREDIT: 'CREDIT'
})

export const LEDGER_SOURCE = Object.freeze({
  ACCRUAL: 'ACCRUAL',
  SETTLEMENT: 'SETTLEMENT'
})

export const TERMINAL_LEDGER_TYPES = new Set([LEDGER_TYPE.UNKNOWN, LEDGER_TYPE.ERROR, LEDGER_TYPE.TIMEOUT])

// the FK dimensions every entry for a given transaction shares. `direction` is denormalized onto
// the ledger so that future reporting can group without joining back to ExternalTransaction.
function ledgerDimensions (transaction) {
  return {
    externalTransactionId: transaction.id,
    userId: transaction.userId,
    walletId: transaction.walletId,
    protocolId: transaction.protocolId,
    direction: transaction.direction
  }
}

// the invoice amount, coerced to a non-negative BigInt.
export function obligationMsats (transaction) {
  return transaction.amountMsats == null ? 0n : BigInt(transaction.amountMsats)
}

// the signed contributed by the OBLIGATION plus a FULFILLMENT, before any correction.
//   RECEIVE: OBLIGATION is a CREDIT, FULFILLMENT a DEBIT
//   SEND: OBLIGATION is a DEBIT, FULFILLMENT a CREDIT
function fulfillmentResidualMsats (direction, obligationAmount, settledAmount) {
  return direction === 'RECEIVE'
    ? obligationAmount - settledAmount
    : settledAmount - obligationAmount
}

// `side` is fully determined by (direction, type) for everything except CORRECTION
export function ledgerSide ({ direction, type, residualMsats = 0n }) {
  if (type === LEDGER_TYPE.CORRECTION) {
    return residualMsats > 0n ? LEDGER_SIDE.DEBIT : LEDGER_SIDE.CREDIT
  }

  const receive = direction === 'RECEIVE'
  if (type === LEDGER_TYPE.OBLIGATION) {
    return receive ? LEDGER_SIDE.CREDIT : LEDGER_SIDE.DEBIT
  }
  return receive ? LEDGER_SIDE.DEBIT : LEDGER_SIDE.CREDIT
}

// `source` is fully determined by `type`: an ACCRUAL books/adjusts an obligation,
// a SETTLEMENT records a reported settled movement.
const LEDGER_SOURCE_BY_TYPE = Object.freeze({
  [LEDGER_TYPE.OBLIGATION]: LEDGER_SOURCE.ACCRUAL,
  [LEDGER_TYPE.FULFILLMENT]: LEDGER_SOURCE.SETTLEMENT,
  [LEDGER_TYPE.CORRECTION]: LEDGER_SOURCE.ACCRUAL,
  [LEDGER_TYPE.UNKNOWN]: LEDGER_SOURCE.SETTLEMENT,
  [LEDGER_TYPE.ERROR]: LEDGER_SOURCE.ACCRUAL,
  [LEDGER_TYPE.TIMEOUT]: LEDGER_SOURCE.ACCRUAL
})

export function ledgerSource (type) {
  const source = LEDGER_SOURCE_BY_TYPE[type]
  if (!source) throw new Error(`no ExternalTransactionLedger source for type ${type}`)
  return source
}

// the opening entry booked when a transaction is created: the invoice amount as
// a receivable (RECEIVE -> CREDIT) or payable (SEND -> DEBIT).
export function obligationEntry (transaction) {
  const amountMsats = obligationMsats(transaction)
  return {
    ...ledgerDimensions(transaction),
    type: LEDGER_TYPE.OBLIGATION,
    side: ledgerSide({ direction: transaction.direction, type: LEDGER_TYPE.OBLIGATION }),
    source: ledgerSource(LEDGER_TYPE.OBLIGATION),
    amountMsats
  }
}

// the entries that close (part of) an obligation at a terminal outcome:
//   - FULFILLMENT: books the exact `settledMsats` reported, plus a CORRECTION for any over/underpayment so
//     the transaction nets to 0. Amountless invoices (obligation 0) surface the whole receipt as this pair.
//   - UNKNOWN / ERROR / TIMEOUT: a single whole-obligation closer for the remaining `openMsats`
//     (obligation - already-fulfilled), on the side opposite the OBLIGATION.
export function terminalEntries ({ transaction, ledgerType, settledMsats, openMsats }) {
  const dims = ledgerDimensions(transaction)

  if (ledgerType === LEDGER_TYPE.FULFILLMENT) {
    const settled = BigInt(settledMsats ?? 0)
    const entries = [{
      ...dims,
      type: LEDGER_TYPE.FULFILLMENT,
      side: ledgerSide({ direction: dims.direction, type: LEDGER_TYPE.FULFILLMENT }),
      source: ledgerSource(LEDGER_TYPE.FULFILLMENT),
      amountMsats: settled
    }]

    const residualMsats = fulfillmentResidualMsats(dims.direction, obligationMsats(transaction), settled)
    if (residualMsats !== 0n) {
      entries.push({
        ...dims,
        type: LEDGER_TYPE.CORRECTION,
        side: ledgerSide({ direction: dims.direction, type: LEDGER_TYPE.CORRECTION, residualMsats }),
        source: ledgerSource(LEDGER_TYPE.CORRECTION),
        amountMsats: residualMsats < 0n ? -residualMsats : residualMsats
      })
    }
    return entries
  }

  // UNKNOWN / ERROR / TIMEOUT close the still-open amount in one whole-obligation entry.
  return [{
    ...dims,
    type: ledgerType,
    side: ledgerSide({ direction: dims.direction, type: ledgerType }),
    source: ledgerSource(ledgerType),
    amountMsats: BigInt(openMsats ?? 0)
  }]
}

// transform side+magniture into a signed BigInt
export function entryNetMsats ({ side, amountMsats }) {
  const magnitude = BigInt(amountMsats)
  return side === LEDGER_SIDE.CREDIT ? magnitude : -magnitude
}

// annotate ledger entries with the accumulated open balance up to and
// including each entry, chronologically. This can be done on api calls where
// the scope is a single ExternalTransaction, as the number of entries is 2-3
export function ledgerEntriesWithBalance (entries = []) {
  let balanceMsats = 0n
  return [...entries]
    .sort((a, b) => (new Date(a.createdAt) - new Date(b.createdAt)) || (a.id - b.id))
    .map(entry => {
      balanceMsats += entryNetMsats(entry)
      return { ...entry, balanceMsats }
    })
}

// the current open balance for an ExternalTransaction
export function ledgerCurrentBalanceMsats (entries = []) {
  return entries.reduce((sum, entry) => sum + entryNetMsats(entry), 0n)
}
