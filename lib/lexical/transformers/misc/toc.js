import {
  $createTableOfContentsNode,
  $isTableOfContentsNode,
  TableOfContentsNode
} from '@/lib/lexical/nodes/misc/toc'

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
