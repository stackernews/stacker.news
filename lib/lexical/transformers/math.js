import { MathNode, $createMathNode, $isMathNode } from '@/lib/lexical/nodes/math/mathnode'

export const MATH = {
  dependencies: [MathNode],
  export: (node) => {
    if (!$isMathNode(node)) {
      return null
    }

    return `$${node.getMath()}$`
  },
  importRegExp: /\$([^$]+?)\$/,
  regExp: /\$([^$]+?)\$$/,
  replace: (textNode, match) => {
    const [, math] = match
    const mathNode = $createMathNode(math, true)
    textNode.replace(mathNode)
  },
  trigger: '$',
  type: 'text-match'
}
