export async function settleAction ({ data: { invoice }, models }) {
  // we need to do this transactionally
  // mark all rows as PAID
  // mark invoice as PAID

  // we need to do this separately and importantly only once
  // run side effects in a separate transaction
}

export async function settleActionError ({ data: { invoice }, models }) {
  // mark all rows as FAILED
  // mark invoice as FAILED
}
