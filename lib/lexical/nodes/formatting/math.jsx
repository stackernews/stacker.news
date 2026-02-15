import { $applyNodeReplacement, DecoratorNode } from 'lexical'
import katex from 'katex'

export const $encodeMath = (math) => Buffer.from(math).toString('base64')
export const $decodeMath = (math) => Buffer.from(math, 'base64').toString('utf-8')

const MAX_MATH_LENGTH = 10000

function $validateMathContent (math) {
  if (!math) return math
  if (math.length > MAX_MATH_LENGTH) {
    console.warn('math too big, truncating')
    return math.slice(0, MAX_MATH_LENGTH)
  }
  return math
}

function $convertMathElement (domNode) {
  let math = domNode.getAttribute('data-lexical-math')
  if (!math) return null
  math = $validateMathContent(math)
  try {
    math = $decodeMath(math)
  } catch (error) {
    console.error('error decoding math', error)
    return null
  }
  if (!math) return null
  const inline = domNode.getAttribute('data-lexical-inline') === 'true'
  return { node: $createMathNode(math, inline) }
}

export class MathNode extends DecoratorNode {
  __math
  __inline

  static getType () {
    return 'math'
  }

  static clone (node) {
    return new MathNode(node.__math, node.__inline, node.__key)
  }

  constructor (math, inline, key) {
    super(key)
    this.__math = $validateMathContent(math)
    this.__inline = inline ?? false
  }

  static importJSON (serializedNode) {
    return $createMathNode(
      serializedNode.math,
      serializedNode.inline
    ).updateFromJSON(serializedNode)
  }

  exportJSON () {
    return {
      ...super.exportJSON(),
      math: this.getMath(),
      inline: this.__inline
    }
  }

  createDOM (_config) {
    const element = document.createElement(this.__inline ? 'span' : 'div')
    element.className = _config.theme.math
    return element
  }

  exportDOM () {
    const element = document.createElement(this.__inline ? 'span' : 'div')
    let math = this.__math
    try {
      math = $encodeMath(math)
    } catch (error) {
      console.error('error encoding math', error)
      return null
    }
    element.setAttribute('data-lexical-math', math)
    element.setAttribute('data-lexical-inline', this.__inline)
    katex.render(this.__math, element, {
      displayMode: !this.__inline,
      errorColor: '#cc0000',
      output: 'html',
      strict: 'warn',
      throwOnError: false,
      trust: false
    })
    return { element }
  }

  static importDOM () {
    return {
      div: (domNode) => {
        if (!domNode.hasAttribute('data-lexical-math')) return null
        return { conversion: $convertMathElement, priority: 2 }
      },
      span: (domNode) => {
        if (!domNode.hasAttribute('data-lexical-math')) return null
        return { conversion: $convertMathElement, priority: 1 }
      }
    }
  }

  isInline () {
    return this.__inline
  }

  updateDOM (prevNode) {
    return this.__inline !== prevNode.__inline
  }

  getTextContent () {
    return this.__math
  }

  getMath () {
    return this.__math
  }

  getInline () {
    return this.__inline
  }

  setMath (math) {
    const writable = this.getWritable()
    writable.__math = $validateMathContent(math)
  }

  decorate () {
    const MathComponent = require('@/components/editor/nodes/math').default
    return (
      <MathComponent
        math={this.__math}
        inline={this.__inline}
        nodeKey={this.getKey()}
      />
    )
  }
}

export const $createMathNode = (math = '', inline = false) => {
  const node = new MathNode(math, inline)
  return $applyNodeReplacement(node)
}

export function $isMathNode (node) {
  return node instanceof MathNode
}
