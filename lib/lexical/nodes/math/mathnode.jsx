import { $applyNodeReplacement, DecoratorNode } from 'lexical'
// remember to use these only when required
// as in SSR we use ssrLexicalHTMLGenerator
import katex from 'katex'
import dynamic from 'next/dynamic'

const MathComponent = dynamic(() => import('./mathcomponent'), { ssr: false })

function $convertEquationElement (domNode) {
  let equation = domNode.getAttribute('data-lexical-equation')
  const inline = domNode.getAttribute('data-lexical-inline') === 'true'

  equation = atob(equation || '')
  if (!equation) return null

  const node = $createMathNode(equation, inline)
  return { node }
}

export class MathNode extends DecoratorNode {
  __equation
  __inline

  static getType () {
    return 'math'
  }

  static clone (node) {
    return new MathNode(node.__equation, node.__inline, node.__key)
  }

  constructor (equation, inline, key) {
    super(key)
    this.__equation = equation
    this.__inline = inline ?? false
  }

  static importJSON (serializedNode) {
    return $createMathNode(serializedNode.equation, serializedNode.inline).updateFromJSON(serializedNode)
  }

  exportJSON () {
    return {
      ...super.exportJSON(),
      equation: this.__equation,
      inline: this.__inline
    }
  }

  createDOM (config) {
    const element = document.createElement(this.__inline ? 'span' : 'div')
    element.className = config.theme.math
    return element
  }

  exportDOM () {
    const element = document.createElement(this.__inline ? 'span' : 'div')
    // b64 to avoid issues with special characters
    const equation = btoa(this.__equation)
    element.setAttribute('data-lexical-equation', equation)
    element.setAttribute('data-lexical-inline', this.__inline)
    katex.render(this.__equation, element, {
      displayMode: !this.__inline,
      errorColor: 'inherit',
      output: 'html',
      strict: 'warn',
      throwOnError: 'warn',
      trust: false
    })
    return { element }
  }

  static importDOM () {
    return {
      div: (domNode) => {
        if (!domNode.hasAttribute('data-lexical-equation')) return null
        return { conversion: $convertEquationElement, priority: 2 }
      },
      span: (domNode) => {
        if (!domNode.hasAttribute('data-lexical-equation')) return null
        return { conversion: $convertEquationElement, priority: 1 }
      }
    }
  }

  updateDOM (prevNode) {
    return this.__inline !== prevNode.__inline
  }

  getTextContent () {
    return this.__equation
  }

  getEquation () {
    return this.__equation
  }

  setEquation (equation) {
    const writable = this.getWritable()
    writable.__equation = equation
  }

  decorate () {
    return (
      <MathComponent equation={this.__equation} inline={this.__inline} nodeKey={this.__key} />
    )
  }
}

export const $createMathNode = (equation = '', inline = false) => {
  const node = new MathNode(equation, inline)
  return $applyNodeReplacement(node)
}

export function $isMathNode (node) {
  return node instanceof MathNode
}
