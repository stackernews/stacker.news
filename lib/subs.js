/**
 * Utilities for working with sub/territory arrays
 */

/**
 * Extract sub names from an array of sub objects or strings
 * @param {Array} subs - Array of sub objects or strings
 * @returns {string[]} Array of sub name strings
 */
export function subNames (subs) {
  if (!subs?.length) return []
  return subs.map(s => typeof s === 'string' ? s : s.name)
}

/**
 * Parse sub names from URL format (e.g., 'bitcoin~nostr' -> ['bitcoin', 'nostr'])
 * @param {string} slugSub - URL sub parameter
 * @returns {string[]} Array of sub name strings
 */
export function subNamesFromSlug (slugSub) {
  if (!slugSub) return []
  return slugSub.split('~').filter(Boolean)
}

/**
 * Generate URL prefix from subs (e.g., '/~bitcoin~nostr')
 * @param {Array} subs - Array of sub objects or strings
 * @returns {string} URL prefix or empty string
 */
export function subsPostPrefix (subs) {
  const names = subNames(subs)
  return names.length ? `/~${names.join('~')}` : ''
}

/**
 * Check if all subs support a given post type
 * @param {Array} subs - Array of sub objects
 * @param {string} postType - Post type to check (e.g., 'LINK', 'DISCUSSION')
 * @returns {boolean}
 */
export function subsAllSupport (subs, postType) {
  if (!subs?.length) return false
  return subs.every(s => s.postTypes?.includes(postType))
}

/**
 * Get post types supported by all subs
 * @param {Array} subs - Array of sub objects
 * @returns {string[]} Array of post types supported by all subs
 */
export function subsCommonPostTypes (subs) {
  if (!subs?.length) return []
  const allTypes = ['LINK', 'DISCUSSION', 'POLL', 'BOUNTY']
  return allTypes.filter(type => subsAllSupport(subs, type))
}

/**
 * Find elements in array a that are not in array b
 * Works with both strings and objects (compares by name property)
 * @param {Array} a - Source array
 * @param {Array} b - Array to subtract
 * @returns {Array} Elements in a but not in b
 */
export function subsDiff (a = [], b = []) {
  const bNames = subNames(b)
  const aNames = subNames(a)
  return aNames.filter(name => !bNames.includes(name))
}

/**
 * Sum a cost field across all subs
 * @param {Array} subs - Array of sub objects
 * @param {string} field - Field to sum ('baseCost' or 'replyCost')
 * @param {number} defaultCost - Default cost if field is missing
 * @returns {number} Total cost in sats
 */
export function sumSubCosts (subs, field = 'baseCost', defaultCost = 1) {
  if (!subs?.length) return defaultCost
  return subs.reduce((acc, sub) => acc + (sub[field] ?? defaultCost), 0)
}
