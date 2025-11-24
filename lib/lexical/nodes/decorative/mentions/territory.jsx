import { DecoratorNode, $applyNodeReplacement } from 'lexical'

function $convertTerritoryMentionElement (domNode) {
  const textContent = domNode.textContent
  const territoryName = domNode.getAttribute('data-lexical-territory-mention-name')

  if (textContent !== null) {
    const node = $createTerritoryMentionNode(territoryName || textContent, textContent)
    return { node }
  }

  return null
}

// TODO: support path like item and user mentions
export class TerritoryMentionNode extends DecoratorNode {
  __territoryMentionName

  static getType () {
    return 'territory-mention'
  }

  getTerritoryMentionName () {
    return this.__territoryMentionName
  }

  static clone (node) {
    return new TerritoryMentionNode(node.__territoryMentionName, node.__key)
  }

  static importJSON (serializedNode) {
    return $createTerritoryMentionNode(serializedNode.territoryMentionName)
  }

  constructor (territoryMentionName, key) {
    super(key)
    this.__territoryMentionName = territoryMentionName
  }

  exportJSON () {
    return {
      type: 'territory-mention',
      version: 1,
      territoryMentionName: this.__territoryMentionName
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
    domNode.setAttribute('data-lexical-territory-mention-name', this.__territoryMentionName)
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
    wrapper.setAttribute('data-lexical-territory-mention-name', this.__territoryMentionName)
    const a = document.createElement('a')
    a.setAttribute('href', '/~' + encodeURIComponent(this.__territoryMentionName.toString()))
    a.textContent = '~' + this.__territoryMentionName
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
    const name = this.__territoryMentionName
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

export function $createTerritoryMentionNode (territoryMentionName) {
  return $applyNodeReplacement(new TerritoryMentionNode(territoryMentionName))
}

export function $isTerritoryMentionNode (node) {
  return node instanceof TerritoryMentionNode
}
