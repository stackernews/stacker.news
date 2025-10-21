import { TRANSFORMERS, CHECK_LIST } from '@lexical/markdown'
import { HR } from './misc/hr'
import { IMAGE } from './content/media'
import { USER_MENTIONS } from './decorative/user-mentions'
import { TERRITORY_MENTIONS } from './decorative/territory-mentions.js'
import { MEDIA_OR_LINK } from './content/media-or-link'
import { LINK } from './decorative/link'
import { ALIGN_TRANSFORMER } from './formatting/alignments'
import { MATH_INLINE } from './formatting/math'
import { TABLE } from './misc/tables'

// wip
export const UNDERLINE = {
  format: ['underline'],
  tag: '++',
  type: 'text-format'
}

const SN_TRANSFORMERS = [
  ALIGN_TRANSFORMER,
  TABLE, // barely working...
  MEDIA_OR_LINK,
  MATH_INLINE,
  HR,
  IMAGE,
  USER_MENTIONS,
  TERRITORY_MENTIONS,
  LINK,
  CHECK_LIST,
  UNDERLINE,
  ...TRANSFORMERS.filter(transformer => transformer !== TRANSFORMERS.find(t => t.type === 'text-match' && t.trigger === ')'))
]

export default SN_TRANSFORMERS
