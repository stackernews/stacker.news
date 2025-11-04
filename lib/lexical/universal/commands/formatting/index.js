import { mdHas } from '@/lib/md'

function isCase (text, type) {
  return type === 'lowercase' ? text.toLowerCase() === text : text.toUpperCase() === text
}

function isCapitalize (text) {
  return text.charAt(0).toUpperCase() === text.charAt(0) && text.slice(1).toLowerCase() === text.slice(1)
}

// wip micromark map
const LEXICAL_TO_MICROMARK_TYPE_MAP = {
  bold: 'strong',
  italic: 'emphasis',
  strikethrough: 'gfmStrikethrough',
  code: 'codeText',
  link: 'link',
  image: 'image',
  quote: 'blockQuote',
  subscript: 'htmlText',
  superscript: 'htmlText'
}

export function lexicalToMicromarkType (lexicalType) {
  return LEXICAL_TO_MICROMARK_TYPE_MAP[lexicalType] || lexicalType
}

export function micromarkToLexicalType (micromarkType) {
  const entry = Object.entries(LEXICAL_TO_MICROMARK_TYPE_MAP).find(([, value]) => value === micromarkType)
  return entry ? entry[0] : micromarkType
}

export function hasMarkdownFormat (selection, type) {
  if (!selection) return
  const text = selection.getTextContent()
  if (!text) return false
  switch (type) {
    case 'lowercase':
    case 'uppercase':
      return isCase(text, type)
    case 'capitalize':
      return isCapitalize(text)
    case 'quote':
      return text.startsWith('>')
    case 'subscript':
      return text.startsWith('<sub>') && text.endsWith('</sub>')
    case 'superscript':
      return text.startsWith('<sup>') && text.endsWith('</sup>')
    default:
      break
  }
  return mdHas(text, lexicalToMicromarkType(type))
}
