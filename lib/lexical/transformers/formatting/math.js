import { MathNode, $createMathNode, $isMathNode } from '@/lib/lexical/nodes/formatting/math/mathnode'

export const MATH_INLINE = {
  dependencies: [MathNode],
  export: (node) => {
    if (!$isMathNode(node)) {
      return null
    }

    return node.getInline() ? `$${node.getMath()}$` : `$$\n${node.getMath()}\n$$`
  },
  importRegExp: /^\$([^$\n]+?)\$$/,
  regExp: /^\$([^$\n]+?)\$$/,
  replace: (textNode, match) => {
    const [, math] = match
    const mathNode = $createMathNode(math, true)
    textNode.replace(mathNode)
  },
  trigger: '$',
  type: 'text-match'
}
