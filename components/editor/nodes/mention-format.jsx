import {
  IS_BOLD,
  IS_CODE,
  IS_HIGHLIGHT,
  IS_ITALIC,
  IS_STRIKETHROUGH,
  IS_SUBSCRIPT,
  IS_SUPERSCRIPT,
  IS_UNDERLINE
} from '@/lib/lexical/mdast/format-constants'

export default function MentionFormat ({ children, format = 0 }) {
  let content = children

  if (format & IS_CODE) content = <code>{content}</code>
  if (format & IS_HIGHLIGHT) content = <mark>{content}</mark>
  if (format & IS_STRIKETHROUGH) content = <s>{content}</s>
  if (format & IS_BOLD) content = <strong>{content}</strong>
  if (format & IS_ITALIC) content = <em>{content}</em>
  if (format & IS_UNDERLINE) content = <u>{content}</u>
  if (format & IS_SUBSCRIPT) content = <sub>{content}</sub>
  if (format & IS_SUPERSCRIPT) content = <sup>{content}</sup>

  return content
}
