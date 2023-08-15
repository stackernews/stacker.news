/**
 * Normalize an array of forwards by converting the pct from a string to a number
 * @param {*} forward Array of forward objects ({nym: string, pct: string})
 * @returns normalized array, or undefined if not provided
 */
export const normalizeForwards = (forward) => {
  if (!Array.isArray(forward)) {
    return undefined
  }
  return forward.map(fwd => ({ ...fwd, pct: Number(fwd.pct) }))
}
