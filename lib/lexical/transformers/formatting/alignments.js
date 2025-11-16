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

    // exportChildren gets text content; manually add # markers for headings
    let inner = exportChildren(node)
    if ($isSNHeadingNode(node)) {
      const tag = node.getTag() || 'h1'
      const level = Number(String(tag).replace('h', '')) || 1
      inner = `${'#'.repeat(level)} ${inner}`
    }

    return `<div align="${formatType}">${inner}</div>`
  },
  // span lines with a multiline import
  regExpStart: /<div align="(left|center|right|justify|start|end|justify-start|justify-end)">/,
  regExpEnd: /<\/div>/,
  replace: (rootNode, _children, startMatch, _endMatch, linesInBetween, isImport) => {
    let [, formatType] = startMatch
    if (formatType === 'start') formatType = 'left'
    if (formatType === 'end') formatType = 'right'
    if (formatType === 'justify-start') formatType = 'left'
    if (formatType === 'justify-end') formatType = 'right'

    const text = (linesInBetween || []).join('\n')

    // parse into a temporary container to avoid appending directly to rootNode
    const tempContainer = $createParagraphNode()
    $convertFromMarkdownString(text, SN_TRANSFORMERS_BASE, tempContainer)

    // extract children from temp container and apply alignment
    const children = tempContainer.getChildren()
    let firstChild = null

    for (const child of children) {
      if ($isParagraphNode(child) || $isSNHeadingNode(child)) {
        child.setFormat(formatType)
      }
      rootNode.append(child)
      if (!firstChild) firstChild = child
    }

    // fallback if nothing was parsed
    if (!firstChild) {
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

    if (!isImport) firstChild.select(0, 0)
    return firstChild
  },
  type: 'multiline-element'
}
