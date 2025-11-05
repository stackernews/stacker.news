import { MathNode, $createMathNode, $isMathNode } from '@/lib/lexical/nodes/formatting/math/mathnode'

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
