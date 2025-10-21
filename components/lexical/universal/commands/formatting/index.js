import { START_END_MARKDOWN_FORMATS } from './inline'
import { mdGetTypes } from '@/lib/md'

function isCase (text, type) {
  return type === 'lowercase' ? text.toLowerCase() === text : text.toUpperCase() === text
}

function isCapitalize (text) {
  return text.charAt(0).toUpperCase() === text.charAt(0) && text.slice(1).toLowerCase() === text.slice(1)
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
  const match = START_END_MARKDOWN_FORMATS[type]
  const hasMd = mdGetTypes(text)
  console.log('intercepted markdown:', hasMd)
  if (!match) return false
  if (Array.isArray(match)) {
    return match.some(marker => text.startsWith(marker) && text.endsWith(marker) && text.length >= marker.length * 2)
  }
  return text.startsWith(match) && text.endsWith(match) && text.length >= match.length * 2
}
