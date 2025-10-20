import { $applyNodeReplacement, DecoratorNode } from 'lexical'
import katex from 'katex'

function $convertMathElement (domNode) {
  let math = domNode.getAttribute('data-lexical-math')
  const inline = domNode.getAttribute('data-lexical-inline') === 'true'

  math = atob(math || '')
  if (!math) return null

  const node = $createMathNode(math, inline)
  return { node }
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
    this.__math = math
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
    // b64 to avoid issues with special characters
    const math = btoa(this.__math)
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
    writable.__math = math
  }

  decorate () {
    const MathComponent = require('./mathcomponent').default
    return (
      <MathComponent
        math={this.__math}
        inline={this.__inline}
        nodeKey={this.__key}
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
