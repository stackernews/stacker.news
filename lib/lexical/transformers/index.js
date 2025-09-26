import { HR } from '@/lib/lexical/transformers/misc'
import { IMAGE } from '@/lib/lexical/transformers/image-markdown-transformer'
import { MENTIONS } from '@/lib/lexical/transformers/mentions'
import { TERRITORIES } from '@/lib/lexical/transformers/territory'
import { MEDIA_OR_LINK } from '@/lib/lexical/transformers/media'
import { TRANSFORMERS } from '@lexical/markdown'

const SN_TRANSFORMERS = [
  MEDIA_OR_LINK,
  HR,
  IMAGE,
  MENTIONS,
  TERRITORIES,
  ...TRANSFORMERS
]

export default SN_TRANSFORMERS
