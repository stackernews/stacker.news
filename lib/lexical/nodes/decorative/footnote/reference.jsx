import { DecoratorNode, $applyNodeReplacement } from 'lexical'

function referenceDOM (config, { identifier, label }) {
  const sup = document.createElement('sup')
  sup.setAttribute('data-lexical-footnote-ref', 'true')
  sup.setAttribute('data-lexical-footnote-ref-id', identifier)
  sup.setAttribute('data-lexical-footnote-ref-label', label)
  const theme = config.theme
  const className = theme.footnoteReference
  if (className !== undefined) {
    sup.className = className
  }
  return sup
}

function $convertFootnoteReferenceElement (domNode) {
  const identifier = domNode.getAttribute('data-lexical-footnote-ref-id')
  const label = domNode.getAttribute('data-lexical-footnote-ref-label')

  if (identifier) {
    const node = $createFootnoteReferenceNode({ identifier, label: label || identifier })
    return { node }
  }

  return null
}

export class FootnoteReferenceNode extends DecoratorNode {
  __identifier
  __label

  static getType () {
    return 'footnote-reference'
  }

  getIdentifier () {
    return this.__identifier
  }

  getLabel () {
    return this.__label
  }

  static clone (node) {
    return new FootnoteReferenceNode(node.__identifier, node.__label, node.__key)
  }

  static importJSON (serializedNode) {
    return $createFootnoteReferenceNode({
      identifier: serializedNode.identifier,
      label: serializedNode.label
    })
  }

  constructor (identifier, label, key) {
    super(key)
    this.__identifier = identifier
    this.__label = label || identifier
  }

  exportJSON () {
    return {
      type: 'footnote-reference',
      version: 1,
      identifier: this.__identifier,
      label: this.__label
    }
  }

  createDOM (config) {
    return referenceDOM(config, { identifier: this.__identifier, label: this.__label })
  }

  exportDOM (editor) {
    const sup = referenceDOM(editor._config, { identifier: this.__identifier, label: this.__label })
    const a = document.createElement('a')
    a.setAttribute('href', `#fn-${this.__identifier}`)
    a.setAttribute('id', `fnref-${this.__identifier}`)
    a.textContent = `[${this.__label}]`
    sup.appendChild(a)
    return { element: sup }
  }

  static importDOM () {
    return {
      sup: (domNode) => {
        if (!domNode.hasAttribute('data-lexical-footnote-ref')) return null
        return { conversion: $convertFootnoteReferenceElement, priority: 1 }
      }
    }
  }

  isInline () {
    return true
  }

  updateDOM () {
    return false
  }

  getTextContent () {
    return `[${this.__label}]`
  }

  decorate () {
    const Link = require('next/link').default
    const identifier = this.__identifier
    const label = this.__label
    return (
      <Link href={`#fn-${identifier}`} id={`fnref-${identifier}`}>
        [{label}]
      </Link>
    )
  }
}

export function $createFootnoteReferenceNode ({ identifier, label }) {
  return $applyNodeReplacement(new FootnoteReferenceNode(identifier, label || identifier))
}

export function $isFootnoteReferenceNode (node) {
  return node instanceof FootnoteReferenceNode
}
