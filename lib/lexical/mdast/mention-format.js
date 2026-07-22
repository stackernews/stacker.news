import { IS_BOLD, IS_HIGHLIGHT, IS_ITALIC, IS_STRIKETHROUGH } from './format-constants'

const FORMAT_BY_TYPE = {
  strong: IS_BOLD,
  emphasis: IS_ITALIC,
  delete: IS_STRIKETHROUGH,
  highlight: IS_HIGHLIGHT
}

export function getLinkTextFormat (node) {
  return (FORMAT_BY_TYPE[node.type] || 0) |
    (node.children || []).reduce((format, child) => format | getLinkTextFormat(child), 0)
}
