# External transaction auditing

This document describes the append-only audit trail that makes every money-movement decision on an
`ExternalTransaction` auditable.

## Types, sources and sides, and how the sign is chosen

| type        | source     | RECEIVE side | SEND side   | amount booked                       |
| ----------- | ---------- | ------------ | ----------- | ----------------------------------- |
| OBLIGATION  | ACCRUAL    | CREDIT       | DEBIT       | invoice amount `A`                  |
| FULFILLMENT | SETTLEMENT | DEBIT        | CREDIT      | exact amount reported `f`           |
| UNKNOWN     | SETTLEMENT | DEBIT        | CREDIT      | invoice amount `A`                  |
| ERROR       | ACCRUAL    | DEBIT        | CREDIT      | invoice amount `A`                  |
| TIMEOUT     | ACCRUAL    | DEBIT        | CREDIT      | invoice amount `A`                  |
| CORRECTION  | ACCRUAL    | amount sign  | amount sign | `ABS(A - SUM(f))` at terminal state |

Examples:

- **Exact pay:** `OBLIGATION +A`, `FULFILLMENT -A`.
- **Underpaid & settled** (`f < A`): `+A`, `FULFILLMENT -f`, `CORRECTION -(A-f)`.
- **Overpaid & settled** (`f > A`): `+A`, `FULFILLMENT -f`, `CORRECTION +(f-A)`.
- **Verification unsupported:** `+A`, `UNKNOWN -A` (booked atomically at create).
- **Provider failure / expiry / give-up:** `+A`, `ERROR|TIMEOUT -A`.
- **Amountless invoice** (`amountMsats` null): `OBLIGATION 0`, `FULFILLMENT -f`, `CORRECTION +f`.

## Guards

### At-most-one initial and final state

Unique indexes constrain the ledger to:

1. Have at most one `OBLIGATION` per `ExternalTransaction`, as all other accrual
   modifications MUST be done through a correction. Implemented in index
   `ExternalTransactionLedger_obligation_uniq`
2. Have at most one terminal state of `UNKNOWN`, `ERROR` or `TIMEOUT`, as no
   no further state changes are allowed after this. Note that `FULFILLMENT` is
   explicitly not included to support any future protocol support of multiple
   partial payments.

### Append-only

Append-only is guarded by the triggers `external_transaction_ledger_no_update`
and `external_transaction_ledger_no_truncate`. Besides inserts, only deletes are
allowed, to support clearing data from a wallet and cascaded deletion of wallet,
protocol and user entities.
