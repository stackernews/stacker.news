import { ElementNode, $applyNodeReplacement } from 'lexical'

function definitionDOM (config, { identifier, label }) {
  const li = document.createElement('li')
  li.id = `fn-${identifier}`
  li.setAttribute('data-lexical-footnote-def', 'true')
  li.setAttribute('data-lexical-footnote-def-id', identifier)
  li.setAttribute('data-lexical-footnote-def-label', label)
  const numericValue = parseInt(identifier, 10)
  if (!isNaN(numericValue)) {
    li.value = numericValue
  }
  const theme = config.theme
  const className = theme.footnoteDefinition
  if (className !== undefined) {
    li.className = className
  }
  return li
}

function $convertFootnoteDefinitionElement (domNode) {
  const identifier = domNode.getAttribute('data-lexical-footnote-def-id')
  const label = domNode.getAttribute('data-lexical-footnote-def-label')

  if (identifier) {
    const node = $createFootnoteDefinitionNode({ identifier, label: label || identifier })
    return { node }
  }

  return null
}

export class FootnoteDefinitionNode extends ElementNode {
  __identifier
  __label

  static getType () {
    return 'footnote-definition'
  }

  getIdentifier () {
    return this.__identifier
  }

  getLabel () {
    return this.__label
  }

  static clone (node) {
    return new FootnoteDefinitionNode(node.__identifier, node.__label, node.__key)
  }

  static importJSON (serializedNode) {
    return $createFootnoteDefinitionNode({
      identifier: serializedNode.identifier,
      label: serializedNode.label
    }).updateFromJSON(serializedNode)
  }

  constructor (identifier, label, key) {
    super(key)
    this.__identifier = identifier
    this.__label = label || identifier
  }

  exportJSON () {
    return {
      ...super.exportJSON(),
      type: 'footnote-definition',
      version: 1,
      identifier: this.__identifier,
      label: this.__label
    }
  }

  createDOM (config) {
    return definitionDOM(config, { identifier: this.__identifier, label: this.__label })
  }

  updateDOM (prevNode, dom) {
    // update id if identifier changed
    if (prevNode.__identifier !== this.__identifier) {
      dom.id = `fn-${this.__identifier}`
      dom.setAttribute('data-lexical-footnote-def-id', this.__identifier)
    }
    if (prevNode.__label !== this.__label) {
      dom.setAttribute('data-lexical-footnote-def-label', this.__label)
    }
    return false
  }

  exportDOM (editor) {
    return {
      element: definitionDOM(
        editor._config,
        { identifier: this.__identifier, label: this.__label }
      )
    }
  }

  static importDOM () {
    return {
      li: (domNode) => {
        if (!domNode.hasAttribute('data-lexical-footnote-def')) return null
        return { conversion: $convertFootnoteDefinitionElement, priority: 1 }
      }
    }
  }

  isInline () {
    return false
  }
}

export function $createFootnoteDefinitionNode ({ identifier, label }) {
  return $applyNodeReplacement(new FootnoteDefinitionNode(identifier, label || identifier))
}

export function $isFootnoteDefinitionNode (node) {
  return node instanceof FootnoteDefinitionNode
}
