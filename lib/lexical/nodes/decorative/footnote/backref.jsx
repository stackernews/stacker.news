import { ElementNode, $applyNodeReplacement } from 'lexical'

function backrefDOM (config, { identifier }) {
  const a = document.createElement('a')
  a.href = `#fnref-${identifier}`
  a.setAttribute('data-lexical-footnote-backref', 'true')
  a.setAttribute('data-lexical-footnote-backref-id', identifier)
  a.setAttribute('aria-label', `back to reference ${identifier}`)
  a.textContent = ' ↩'
  const theme = config.theme
  const className = theme.footnoteBackref
  if (className !== undefined) {
    a.className = className
  }
  return a
}

function $convertFootnoteBackrefElement (domNode) {
  const identifier = domNode.getAttribute('data-lexical-footnote-backref-id')
  if (identifier) {
    return { node: $createFootnoteBackrefNode({ identifier }) }
  }
  return null
}

export class FootnoteBackrefNode extends ElementNode {
  __identifier

  static getType () {
    return 'footnote-backref'
  }

  getIdentifier () {
    return this.__identifier
  }

  static clone (node) {
    return new FootnoteBackrefNode(node.__identifier, node.__key)
  }

  static importJSON (serializedNode) {
    return $createFootnoteBackrefNode({
      identifier: serializedNode.identifier
    })
  }

  constructor (identifier, key) {
    super(key)
    this.__identifier = identifier
  }

  exportJSON () {
    return {
      ...super.exportJSON(),
      type: 'footnote-backref',
      version: 1,
      identifier: this.__identifier
    }
  }

  createDOM (config) {
    return backrefDOM(config, { identifier: this.__identifier })
  }

  exportDOM (editor) {
    return { element: backrefDOM(editor._config, { identifier: this.__identifier }) }
  }

  static importDOM () {
    return {
      a: (domNode) => {
        if (!domNode.hasAttribute('data-lexical-footnote-backref')) return null
        return { conversion: $convertFootnoteBackrefElement, priority: 1 }
      }
    }
  }

  isInline () {
    return true
  }

  updateDOM () {
    return false
  }
}

export function $createFootnoteBackrefNode ({ identifier }) {
  return $applyNodeReplacement(new FootnoteBackrefNode(identifier))
}

export function $isFootnoteBackrefNode (node) {
  return node instanceof FootnoteBackrefNode
}
