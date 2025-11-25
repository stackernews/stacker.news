import { codes } from 'micromark-util-symbol'
import { delimitedSpan } from './factory'

/** creates underline extension for micromark
 * @returns {Object} underline extension
 */
export const underline = () => delimitedSpan({ name: 'underline', marker: codes.plusSign, single: false })

/** creates highlight extension for micromark
 * @returns {Object} highlight extension
 */
export const highlight = () => delimitedSpan({ name: 'highlight', marker: codes.equalsTo, single: false })
