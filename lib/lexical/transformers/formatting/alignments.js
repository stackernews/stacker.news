import { $createParagraphNode, $createTextNode, $isParagraphNode } from 'lexical'
import { $isHeadingNode } from '@lexical/rich-text'
import { $convertFromMarkdownString, TRANSFORMERS } from '@lexical/markdown'

// Lexical markdown transformer for align elements
export const ALIGN_TRANSFORMER = {
  dependencies: [],
  export: (node, exportChildren) => {
    if (!$isParagraphNode(node) && !$isHeadingNode(node)) return null
    const formatType = node.getFormatType()
    if (!formatType || formatType === 'left') return null

    // build inner markdown; preserve heading markers if it's a heading
    let inner = exportChildren(node)
    if ($isHeadingNode(node)) {
      const tag = node.getTag ? node.getTag() : 'h1'
      const level = Number(String(tag).replace('h', '')) || 1
      inner = `${'#'.repeat(level)} ${inner}`
    }

    return `<div align="${formatType}">${inner}</div>`
  },
  // span lines with a multiline import
  regExpStart: /<div align="(left|center|right|justify|start)">/,
  regExpEnd: /<\/div>/,
  replace: (rootNode, _children, startMatch, _endMatch, linesInBetween, isImport) => {
    let [, formatType] = startMatch
    if (formatType === 'start') formatType = 'left'

    const text = (linesInBetween || []).join('\n')

    // remember last child to detect which nodes we add
    const before = rootNode.getLastChild()
    // parse the inner content as markdown using standard transformers
    $convertFromMarkdownString(text, TRANSFORMERS, rootNode)

    // collect inserted nodes and apply alignment to paragraphs/headings
    const firstInserted = before ? before.getNextSibling() : rootNode.getFirstChild()
    let node = firstInserted
    while (node) {
      if ($isParagraphNode(node) || $isHeadingNode(node)) {
        node.setFormat(formatType)
      }
      if (node === rootNode.getLastChild()) break
      node = node.getNextSibling()
    }

    // fallback if nothing was parsed (unlikely)
    if (!firstInserted) {
      const p = $createParagraphNode()
      p.setFormat(formatType)
      const parts = text.split('\n')
      for (let i = 0; i < parts.length; i++) {
        p.append($createTextNode(parts[i]))
        if (i < parts.length - 1) p.append($createTextNode('\n'))
      }
      rootNode.append(p)
      if (!isImport) p.select(0, 0)
      return p
    }

    if (!isImport) firstInserted.select(0, 0)
    return firstInserted
  },
  type: 'multiline-element'
}
