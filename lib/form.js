import { MAX_TITLE_LENGTH } from './constants'
import { numWithUnits } from './format'

/**
 * Normalize an array of forwards by converting the pct from a string to a number
 * Also extracts nym from nested user object, if necessary
 * @param {*} forward Array of forward objects ({nym?: string, pct: string, user?: { name: string } })
 * @returns normalized array, or undefined if not provided
 */
export const normalizeForwards = (forward) => {
  if (!Array.isArray(forward)) {
    return undefined
  }
  return forward.filter(fwd => fwd.nym || fwd.user?.name).map(fwd => ({ nym: fwd.nym ?? fwd.user?.name, pct: Number(fwd.pct) }))
}

export const titleInputHint = (formik) =>
  <span className='text-muted'>
    {`${numWithUnits(MAX_TITLE_LENGTH - (formik.values.title || '').length, { abbreviate: false, unitSingular: 'character', unitPlural: 'characters' })} remaining`}
  </span>
