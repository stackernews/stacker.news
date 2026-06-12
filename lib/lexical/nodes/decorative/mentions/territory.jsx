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

/** writes territory mention fields as data attributes so the node can be losslessly
 * reconstructed from HTML into Lexical (see $convertTerritoryMentionElement) */
function setTerritoryMentionHydrationAttributes (node, el) {
  el.setAttribute('data-lexical-territory-mention', true)
  el.setAttribute('data-lexical-territory-mention-name', node.getName())
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
    setTerritoryMentionHydrationAttributes(this, domNode)
    return domNode
  }

  // we need to find a way to allow display name changes
  exportDOM (editor) {
    const wrapper = document.createElement('span')
    const theme = editor._config.theme
    const className = theme.territoryMention
    if (className !== undefined) {
      wrapper.className = className
    }
    setTerritoryMentionHydrationAttributes(this, wrapper)
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

  getTextContent () {
    return '~' + this.__name
  }

  decorate () {
    const name = this.__name
    const href = '/~' + name
    const SubPopover = require('@/components/sub-popover').default
    const MentionsComponent = require('@/components/editor/nodes/mentions').default
    const text = '~' + name
    return (
      <SubPopover sub={name}>
        <MentionsComponent nodeKey={this.getKey()} href={href} text={text} />
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
