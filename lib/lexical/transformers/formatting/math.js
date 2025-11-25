import { MathNode, $createMathNode, $isMathNode } from '@/lib/lexical/nodes/formatting/math'

/** math inline transformer
 *
 *  rich mode: gets a math node and creates the appropriate markdown equivalent
 *
 *  markdown mode: from $math$ to math node
 *
 */
export const MATH_INLINE = {
  dependencies: [MathNode],
  export: (node) => {
    if (!$isMathNode(node)) {
      return null
    }

    return node.getInline() ? `$${node.getMath()}$` : null
  },
  importRegExp: /\$\$?([^$\n]+?)\$\$?/,
  regExp: /\$\$?([^$\n]+?)\$\$?$/,
  replace: (textNode, match) => {
    const [, math] = match
    const mathNode = $createMathNode(math, true)
    textNode.replace(mathNode)
  },
  trigger: '$',
  type: 'text-match'
}

/** math block transformer
 *
 *  rich mode: gets a math node and creates the appropriate markdown equivalent
 *
 *  markdown mode: from $$math$$ to math node
 *
 */
export const MATH_BLOCK = {
  dependencies: [MathNode],
  export: (node) => {
    if (!$isMathNode(node)) {
      return null
    }

    return !node.getInline() ? `$$\n${node.getMath()}\n$$` : null
  },
  regExpStart: /^\$\$\s*$/,
  regExpEnd: /^\$\$\s*$/,
  replace: (rootNode, children, startMatch, endMatch, linesInBetween, isImport) => {
    const math = linesInBetween.join('\n')
    const mathNode = $createMathNode(math, false)
    rootNode.append(mathNode)
    if (!isImport) {
      mathNode.selectNext()
    }
    return mathNode
  },
  type: 'multiline-element'
}
