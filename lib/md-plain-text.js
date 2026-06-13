export function compactPlainText (text) {
  return text
    .replace(/\\([,;:!])/g, '$1')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim()
}

function joinPlainText (values) {
  return values
    .map(value => compactPlainText(nodePlainText(value)))
    .filter(Boolean)
    .join(' ')
}

export function nodePlainText (node) {
  if (!node) return ''

  switch (node.type) {
    case 'text':
    case 'inlineCode':
    case 'code':
    case 'math':
    case 'inlineMath':
      return node.value ?? ''
    case 'image':
    case 'imageReference':
      return node.alt ?? ''
    case 'html':
    case 'thematicBreak':
    case 'definition':
    case 'footnoteDefinition':
      return ''
    case 'break':
      return ' '
    default:
      return joinPlainText(node.children ?? [])
  }
}
