import { toPositiveNumber } from '@/lib/format'

export function walletAmountToMsats (amount) {
  while (amount?.msat != null) amount = amount.msat
  if (typeof amount === 'string' && amount.endsWith('msat')) amount = amount.slice(0, -4)
  return nonNegativeBigInt(amount)
}

// best-effort companion for OPTIONAL amounts (a settled amount or fee, not a balance): undefined
// instead of throwing, so settlement paths don't each re-wrap the strict form in try/catch.
export function walletAmountToMsatsOrUndefined (amount) {
  try {
    return walletAmountToMsats(amount)
  } catch {
    return undefined
  }
}

export function walletAmountToSats (amount) {
  while (amount?.sat != null) amount = amount.sat
  // a { msat } object or a "…msat" string is msat-denominated, so convert (flooring any sub-sat
  // remainder); a bare number/string or a { sat } value is already in sats.
  if (isMsatDenominated(amount)) return toPositiveNumber(walletAmountToMsats(amount) / 1000n)
  return toPositiveNumber(nonNegativeBigInt(amount))
}

export function walletAmountToSatsOrUndefined (amount) {
  try {
    return walletAmountToSats(amount)
  } catch {
    return undefined
  }
}

function isMsatDenominated (amount) {
  return amount?.msat != null || (typeof amount === 'string' && amount.endsWith('msat'))
}

function nonNegativeBigInt (amount) {
  let value
  if (typeof amount === 'bigint') value = amount
  else if (typeof amount === 'number' && Number.isSafeInteger(amount)) value = BigInt(amount)
  else if (typeof amount === 'string' && /^\d+$/.test(amount)) value = BigInt(amount)
  else throw new Error('invalid wallet amount')

  if (value < 0n) throw new Error('invalid wallet amount')
  return value
}
