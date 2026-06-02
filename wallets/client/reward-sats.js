export function rewardSatsBalance (privates) {
  return Math.max((privates?.sats ?? 0) - (privates?.credits ?? 0), 0)
}
