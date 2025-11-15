import { $createParagraphNode, $createTextNode, $isParagraphNode } from 'lexical'
import { $isSNHeadingNode } from '@/lib/lexical/nodes/misc/heading'
import { $convertFromMarkdownString } from '@lexical/markdown'
import { SN_TRANSFORMERS_BASE } from '../sn'

/** lexical markdown transformer for align elements
 *
 *  rich mode: gets a paragraph or heading node and creates \<div align="left|center|right|justify">...<\/div>
 *
 *  markdown mode: from \<div align="left|center|right|justify">...<\/div> to paragraph or heading node
 *
 */
export const ALIGN_TRANSFORMER = {
  dependencies: [],
  export: (node, exportChildren) => {
    if (!$isParagraphNode(node) && !$isSNHeadingNode(node)) return null
    const formatType = node.getFormatType()
    if (!formatType || formatType === 'left') return null

    // build inner markdown; preserve heading markers if it's a heading
    let inner = exportChildren(node)
    if ($isSNHeadingNode(node)) {
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
    // parse the inner content as markdown using SN transformers
    $convertFromMarkdownString(text, SN_TRANSFORMERS_BASE, rootNode)

    // collect inserted nodes and apply alignment to paragraphs/headings
    const firstInserted = before ? before.getNextSibling() : rootNode.getFirstChild()
    let node = firstInserted
    while (node) {
      if ($isParagraphNode(node) || $isSNHeadingNode(node)) {
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
