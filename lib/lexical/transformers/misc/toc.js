import {
  $createTableOfContentsNode,
  $isTableOfContentsNode,
  TableOfContentsNode
} from '@/lib/lexical/nodes/misc/toc'

/** table of contents transformer
 *
 *  rich mode: gets a table of contents node and creates {:toc}
 *
 *  markdown mode: from {:toc} to table of contents node
 *
 */
export const TABLE_OF_CONTENTS = {
  dependencies: [TableOfContentsNode],
  export: (node) => {
    if (!$isTableOfContentsNode(node)) {
      return null
    }
    return '{:toc}'
  },
  regExp: /^\{:toc\}\s?$/,
  replace: (parentNode, _1, _2, isImport) => {
    const tocNode = $createTableOfContentsNode()

    if (isImport || parentNode.getNextSibling() != null) {
      parentNode.replace(tocNode)
    } else {
      parentNode.insertBefore(tocNode)
    }

    tocNode.selectNext()
  },
  type: 'element'
}
