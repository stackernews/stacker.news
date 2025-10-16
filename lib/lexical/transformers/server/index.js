import { TRANSFORMERS } from '@lexical/markdown'
import { MEDIA_OR_LINK } from '@/lib/lexical/transformers/media'
import SN_TRANSFORMERS from '@/lib/lexical/transformers'

const SERVER_SN_TRANSFORMERS = [
  MEDIA_OR_LINK,
  ...SN_TRANSFORMERS,
  ...TRANSFORMERS
]

export default SERVER_SN_TRANSFORMERS
