import { codes } from 'micromark-util-symbol'
import { delimitedSpan } from './factory'

export const underline = () => delimitedSpan({ name: 'underline', marker: codes.plusSign, single: false })
export const highlight = () => delimitedSpan({ name: 'highlight', marker: codes.equalsTo, single: false })
