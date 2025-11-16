import { mdHas } from '@/lib/md'

/**
 * checks if text is uppercase or lowercase
 * @param {string} text - text to check
 * @param {string} type - 'lowercase' or 'uppercase'
 * @returns {boolean} true if text matches the case type
 */
function isCase (text, type) {
  return type === 'lowercase' ? text.toLowerCase() === text : text.toUpperCase() === text
}

/**
 * checks if text is capitalized
 * @param {string} text - text to check
 * @returns {boolean} true if first character is uppercase and rest is lowercase
 */
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

/**
 * maps Lexical format types to micromark types
 * @param {string} lexicalType - lexical format type
 * @returns {string} corresponding micromark type
 */
export function lexicalToMicromarkType (lexicalType) {
  return LEXICAL_TO_MICROMARK_TYPE_MAP[lexicalType] || lexicalType
}

/**
 * checks if a selection has a specific markdown format
 * @param {Object} selection - lexical selection object
 * @param {string} type - format type to check for
 * @returns {boolean} true if selection has the format
 */
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
