import { IS_BOLD, IS_ITALIC, IS_STRIKETHROUGH } from '../mdast/format-constants'

export function getStyleFromLexicalFormat (format) {
  const style = {}
  if (format & IS_BOLD) {
    style.fontWeight = 'bold'
  }
  if (format & IS_ITALIC) {
    style.fontStyle = 'italic'
  }
  if (format & IS_STRIKETHROUGH) {
    style.textDecoration = 'line-through'
  }
  return style
}
