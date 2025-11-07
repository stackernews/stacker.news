import {
  HorizontalRuleNode,
  $createHorizontalRuleNode,
  $isHorizontalRuleNode
} from '@lexical/extension'

/** horizontal rule transformer
 *
 *  rich mode: gets a horizontal rule node and creates ***
 *
 *  markdown mode: from --- or *** or ___ to horizontal rule node
 *
 */
export const HR = {
  dependencies: [HorizontalRuleNode],
  export: (node) => {
    return $isHorizontalRuleNode(node) ? '***' : null
  },
  regExp: /^(-\s?){3,}|(-{3,21}|\*{3,21}|_{3,21})\s?/,
  replace: (parentNode, _1, _2, isImport) => {
    const line = $createHorizontalRuleNode()

    // TODO: Get rid of isImport flag
    if (isImport || parentNode.getNextSibling() != null) {
      parentNode.replace(line)
    } else {
      parentNode.insertBefore(line)
    }

    line.selectNext()
  },
  type: 'element'
}
