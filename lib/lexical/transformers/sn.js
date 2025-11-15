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

export const SN_TEXT_MATCH_TRANSFORMERS = [
  USER_MENTIONS,
  TERRITORY_MENTIONS,
  SN_ITEM_FULL_LINK,
  AUTOLINK,
  LINK,
  MEDIA,
  MATH_INLINE
]

export const SN_ELEMENT_TRANSFORMERS = [
  HEADING,
  TABLE,
  TABLE_OF_CONTENTS,
  HR,
  CHECK_LIST,
  PARENTHESES_LIST,
  PERMISSIVE_QUOTE,
  ...ELEMENT_TRANSFORMERS
]

export const SN_MULTILINE_ELEMENT_TRANSFORMERS = [
  MATH_BLOCK,
  ...MULTILINE_ELEMENT_TRANSFORMERS
]

export const SN_TEXT_FORMAT_TRANSFORMERS = [
  UNDERLINE,
  ...TEXT_FORMAT_TRANSFORMERS
]

export const SN_TRANSFORMERS_BASE = [
  ...SN_ELEMENT_TRANSFORMERS,
  ...SN_MULTILINE_ELEMENT_TRANSFORMERS,
  ...SN_TEXT_FORMAT_TRANSFORMERS,
  ...SN_TEXT_MATCH_TRANSFORMERS
]
