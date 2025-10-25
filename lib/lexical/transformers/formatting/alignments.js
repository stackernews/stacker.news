import { $createParagraphNode, $createTextNode, $isParagraphNode } from 'lexical'
import { $isHeadingNode } from '@lexical/rich-text'

// Lexical markdown transformer for align elements
export const ALIGN_TRANSFORMER = {
  dependencies: [],
  export: (node, exportChildren) => {
    if (!$isParagraphNode(node) && !$isHeadingNode(node)) return null
    const formatType = node.getFormatType()
    if (!formatType || formatType === 'left') return null
    // build the resulting markdown
    return `<div align="${formatType}">${exportChildren(node)}</div>`
  },
  // span lines with a multiline import
  regExpStart: /<div align="(left|center|right|justify|start)">/,
  regExpEnd: /<\/div>/,
  replace: (rootNode, _children, startMatch, _endMatch, linesInBetween, isImport) => {
    let [, formatType] = startMatch
    const p = $createParagraphNode()
    // set the format type from the match
    if (formatType === 'start') formatType = 'left'
    p.setFormat(formatType)

    const text = (linesInBetween || []).join('\n')
    if (text.length) {
      const parts = text.split('\n')
      for (let i = 0; i < parts.length; i++) {
        p.append($createTextNode(parts[i]))
        if (i < parts.length - 1) {
          p.append($createTextNode('\n'))
        }
      }
    }
    rootNode.append(p)
    if (!isImport) p.select(0, 0)
    return p
  },
  type: 'multiline-element'
}
