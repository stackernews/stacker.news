import { CHECK_LIST, ELEMENT_TRANSFORMERS, MULTILINE_ELEMENT_TRANSFORMERS, TEXT_FORMAT_TRANSFORMERS } from '@lexical/markdown'
import { HR } from './misc/hr'
import { MEDIA } from './content/media'
import { USER_MENTIONS } from './decorative/mentions/user'
import { TERRITORY_MENTIONS } from './decorative/mentions/territory'
import { AUTOLINK } from './content/autolink'
import { LINK } from './content/link'
import { MATH_INLINE, MATH_BLOCK } from './formatting/math'
import { TABLE } from './misc/tables'
import { SN_ITEM_FULL_LINK } from './decorative/mentions/item'
import { UNDERLINE } from './formatting/inline'
import { PARENTHESES_LIST } from './formatting/parentheses-list'
import { PERMISSIVE_QUOTE } from './formatting/permissive-quote'
import { TABLE_OF_CONTENTS } from './misc/toc'
import { HEADING } from './formatting/headings'

export const SN_TRANSFORMERS = [
  HEADING,
  TABLE, // wip
  TABLE_OF_CONTENTS,
  SN_ITEM_FULL_LINK,
  AUTOLINK,
  MATH_INLINE,
  MATH_BLOCK,
  HR,
  MEDIA,
  USER_MENTIONS,
  TERRITORY_MENTIONS,
  LINK,
  CHECK_LIST,
  PARENTHESES_LIST,
  PERMISSIVE_QUOTE,
  UNDERLINE,
  ...ELEMENT_TRANSFORMERS,
  ...MULTILINE_ELEMENT_TRANSFORMERS,
  ...TEXT_FORMAT_TRANSFORMERS
]
