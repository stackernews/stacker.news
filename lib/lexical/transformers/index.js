import { TRANSFORMERS, CHECK_LIST } from '@lexical/markdown'
import { HR } from './misc/hr'
import { IMAGE } from './content/media'
import { MENTIONS } from './decorative/mentions'
import { TERRITORIES } from './decorative/territory'
import { MEDIA_OR_LINK } from './content/media-or-link'
import { LINK } from './decorative/link'
import { ALIGN_TRANSFORMER } from './formatting/alignments'
import { MATH } from './formatting/math'
import { TABLE } from './misc/tables'

const SN_TRANSFORMERS = [
  ALIGN_TRANSFORMER,
  TABLE, // barely working...
  MEDIA_OR_LINK,
  MATH,
  HR,
  IMAGE,
  MENTIONS,
  TERRITORIES,
  LINK,
  CHECK_LIST,
  ...TRANSFORMERS.filter(transformer => transformer !== TRANSFORMERS.find(t => t.type === 'text-match' && t.trigger === ')'))
]

export default SN_TRANSFORMERS
