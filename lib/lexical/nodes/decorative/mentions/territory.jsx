import { DecoratorNode, $applyNodeReplacement } from 'lexical'

function $convertTerritoryMentionElement (domNode) {
  const textContent = domNode.textContent
  const territoryName = domNode.getAttribute('data-lexical-territory-mention-name')

  if (textContent !== null) {
    const node = $createTerritoryMentionNode({ name: territoryName || textContent })
    return { node }
  }

  return null
}

// TODO: support path like item and user mentions
export class TerritoryMentionNode extends DecoratorNode {
  __name

  static getType () {
    return 'territory-mention'
  }

  getName () {
    return this.__name
  }

  static clone (node) {
    return new TerritoryMentionNode(node.__name, node.__key)
  }

  static importJSON (serializedNode) {
    return $createTerritoryMentionNode({ name: serializedNode.name })
  }

  constructor (name, key) {
    super(key)
    this.__name = name
  }

  exportJSON () {
    return {
      type: 'territory-mention',
      version: 1,
      name: this.__name
    }
  }

  createDOM (config) {
    const domNode = document.createElement('span')
    const theme = config.theme
    const className = theme.territoryMention
    if (className !== undefined) {
      domNode.className = className
    }
    domNode.setAttribute('data-lexical-territory-mention', true)
    domNode.setAttribute('data-lexical-territory-mention-name', this.__name)
    return domNode
  }

  // we need to find a way to allow display name changes
  exportDOM (editor) {
    const wrapper = document.createElement('span')
    wrapper.setAttribute('data-lexical-territory-mention', true)
    const theme = editor._config.theme
    const className = theme.territoryMention
    if (className !== undefined) {
      wrapper.className = className
    }
    wrapper.setAttribute('data-lexical-territory-mention-name', this.__name)
    const a = document.createElement('a')
    a.setAttribute('href', '/~' + encodeURIComponent(this.__name.toString()))
    a.textContent = '~' + this.__name
    wrapper.appendChild(a)
    return { element: wrapper }
  }

  static importDOM () {
    return {
      span: (domNode) => {
        if (!domNode.hasAttribute('data-lexical-territory-mention')) return null
        return { conversion: $convertTerritoryMentionElement, priority: 1 }
      }
    }
  }

  isInline () {
    return true
  }

  updateDOM () {
    return false
  }

  decorate () {
    const name = this.__name
    const href = '/~' + name
    const SubPopover = require('@/components/sub-popover').default
    const Link = require('next/link').default
    return (
      <SubPopover sub={name}>
        <Link href={href}>~{name}</Link>
      </SubPopover>
    )
  }
}

export function $createTerritoryMentionNode ({ name }) {
  return $applyNodeReplacement(new TerritoryMentionNode(name))
}

export function $isTerritoryMentionNode (node) {
  return node instanceof TerritoryMentionNode
}
