import { HR } from '@/lib/lexical/transformers/misc'
import { IMAGE } from '@/lib/lexical/transformers/image-markdown-transformer'
import { MENTIONS } from '@/lib/lexical/transformers/mentions'
import { TERRITORIES } from '@/lib/lexical/transformers/territory'
import { MEDIA_OR_LINK } from '@/lib/lexical/transformers/media'
import { TRANSFORMERS, CHECK_LIST } from '@lexical/markdown'
import { LINK } from '@/lib/lexical/transformers/link'
import { ALIGN_TRANSFORMER } from '@/lib/lexical/transformers/alignments'
import { MATH } from '@/lib/lexical/transformers/math'

const SN_TRANSFORMERS = [
  // TABLES, oh these goddamn tables, it's going to be a long transformer
  ALIGN_TRANSFORMER,
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
