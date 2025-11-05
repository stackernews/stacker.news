import { CHECK_LIST, ELEMENT_TRANSFORMERS, MULTILINE_ELEMENT_TRANSFORMERS, TEXT_FORMAT_TRANSFORMERS } from '@lexical/markdown'
import { HR } from './misc/hr'
import { IMAGE } from './content/media'
import { USER_MENTIONS } from './decorative/user-mentions'
import { TERRITORY_MENTIONS } from './decorative/territory-mentions.js'
import { MEDIA_OR_LINK } from './content/media-or-link'
import { LINK } from './decorative/link'
import { ALIGN_TRANSFORMER } from './formatting/alignments'
import { MATH_INLINE } from './formatting/math'
import { TABLE } from './misc/tables'
import { SN_ITEM_HASHTAG, SN_ITEM_FULL_LINK } from './misc/sn-item'
import { UNDERLINE } from './formatting/inline'
import { PARENTHESES_LIST } from './formatting/parentheses-list'
import { PERMISSIVE_QUOTE } from './formatting/permissive-quote'

const SN_TRANSFORMERS = [
  ALIGN_TRANSFORMER,
  TABLE, // wip
  SN_ITEM_HASHTAG,
  SN_ITEM_FULL_LINK,
  MEDIA_OR_LINK,
  MATH_INLINE,
  HR,
  IMAGE,
  USER_MENTIONS,
  TERRITORY_MENTIONS,
  LINK,
  CHECK_LIST,
  PARENTHESES_LIST, // Must come before ELEMENT_TRANSFORMERS to match before ORDERED_LIST
  PERMISSIVE_QUOTE,
  UNDERLINE,
  ...ELEMENT_TRANSFORMERS,
  ...MULTILINE_ELEMENT_TRANSFORMERS,
  ...TEXT_FORMAT_TRANSFORMERS
]

export default SN_TRANSFORMERS
