import { DecoratorNode, $applyNodeReplacement } from 'lexical'

function backrefDOM (config, identifier) {
  const a = document.createElement('a')
  a.href = `#fnref-${identifier}`
  a.setAttribute('data-lexical-footnote-backref', 'true')
  a.setAttribute('data-lexical-footnote-backref-id', identifier)
  a.setAttribute('aria-label', `back to reference ${identifier}`)
  a.textContent = ' ↩'
  const className = config.theme.footnoteBackref
  if (className !== undefined) a.className = className
  return a
}

function $convertFootnoteBackrefElement (domNode) {
  const identifier = domNode.getAttribute('data-lexical-footnote-backref-id')
  if (identifier) {
    return { node: $createFootnoteBackrefNode({ identifier }) }
  }
  return null
}

export class FootnoteBackrefNode extends DecoratorNode {
  __identifier

  static getType () {
    return 'footnote-backref'
  }

  static clone (node) {
    return new FootnoteBackrefNode(node.__identifier, node.__key)
  }

  static importJSON (serializedNode) {
    return $createFootnoteBackrefNode({ identifier: serializedNode.identifier })
  }

  static importDOM () {
    return {
      a: (domNode) => domNode.hasAttribute('data-lexical-footnote-backref')
        ? { conversion: $convertFootnoteBackrefElement, priority: 1 }
        : null
    }
  }

  constructor (identifier, key) {
    super(key)
    this.__identifier = identifier
  }

  getIdentifier () {
    return this.__identifier
  }

  exportJSON () {
    return { type: 'footnote-backref', version: 1, identifier: this.__identifier }
  }

  createDOM (config) {
    return backrefDOM(config, this.__identifier)
  }

  exportDOM (editor) {
    return { element: backrefDOM(editor._config, this.__identifier) }
  }

  isInline () {
    return true
  }

  updateDOM () {
    return false
  }

  // backref is present in the DOM
  decorate () {
    return null
  }
}

export function $createFootnoteBackrefNode ({ identifier }) {
  return $applyNodeReplacement(new FootnoteBackrefNode(identifier))
}

export function $isFootnoteBackrefNode (node) {
  return node instanceof FootnoteBackrefNode
}
