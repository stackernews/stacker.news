import { SN_TRANSFORMERS_BASE } from './sn'
import { ALIGN_TRANSFORMER } from './formatting/alignments'
import { SPOILER } from './decorative/spoiler'

// combine all transformers, alignment needs SN_TRANSFORMERS to be defined first
export default [...SN_TRANSFORMERS_BASE, ALIGN_TRANSFORMER, SPOILER]
