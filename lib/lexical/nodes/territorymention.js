import { DecoratorNode, $applyNodeReplacement } from 'lexical'

function $convertTerritoryElement (domNode) {
  const textContent = domNode.textContent
  const territoryName = domNode.getAttribute('data-lexical-territory-name')

  if (textContent !== null) {
    const node = $createTerritoryNode(territoryName || textContent, textContent)
    return { node }
  }

  return null
}

export class TerritoryNode extends DecoratorNode {
  __territory

  static getType () {
    return 'territory'
  }

  getTerritoryName () {
    return this.__territory
  }

  static clone (node) {
    return new TerritoryNode(node.__territory, node.__key)
  }

  static importJSON (serializedNode) {
    return $createTerritoryNode(serializedNode.territoryName)
  }

  constructor (territoryName, key) {
    super(key)
    this.__territory = territoryName
  }

  exportJSON () {
    return {
      type: 'territory',
      version: 1,
      territoryName: this.__territory
    }
  }

  createDOM (config) {
    const domNode = document.createElement('span')
    const theme = config.theme
    const className = theme.territory
    if (className !== undefined) {
      domNode.className = className
    }
    domNode.setAttribute('data-lexical-territory', true)
    domNode.setAttribute('data-lexical-territory-name', this.__territory)
    domNode.setAttribute('data-territory-text', '~' + this.__territory)
    return domNode
  }

  // we need to find a way to allow display name changes
  exportDOM (editor) {
    const wrapper = document.createElement('span')
    wrapper.setAttribute('data-lexical-territory', true)
    const theme = editor._config.theme
    const className = theme.territory
    if (className !== undefined) {
      wrapper.className = className
    }
    wrapper.setAttribute('data-lexical-territory-name', this.__territory)
    const a = document.createElement('a')
    a.setAttribute('href', '/~' + this.__territory)
    a.textContent = '~' + this.__territory
    wrapper.appendChild(a)
    return { element: wrapper }
  }

  static importDOM () {
    return {
      span: (domNode) => {
        if (!domNode.hasAttribute('data-lexical-territory')) return null
        return { conversion: $convertTerritoryElement, priority: 1 }
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
    const SubPopover = require('@/components/sub-popover').default
    const Link = require('next/link').default

    const name = this.__territory
    const href = '/~' + name
    return (
      <SubPopover sub={name}>
        <Link href={href}>~{name}</Link>
      </SubPopover>
    )
  }
}

export function $createTerritoryNode (territoryName) {
  return $applyNodeReplacement(new TerritoryNode(territoryName))
}

export function $isTerritoryNode (node) {
  return node instanceof TerritoryNode
}
