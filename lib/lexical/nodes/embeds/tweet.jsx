import { DecoratorBlockNode } from '@lexical/react/LexicalDecoratorBlockNode'
import { placeholderNode } from './placeholder'

function $convertTweetElement (domNode) {
  const id = domNode.getAttribute('data-lexical-tweet-id')
  const src = domNode.getAttribute('data-lexical-tweet-src')
  if (!id) return null
  const node = $createTweetNode(id, src)
  return { node }
}

export class TweetNode extends DecoratorBlockNode {
  __id
  __src

  static getType () {
    return 'tweet'
  }

  static clone (node) {
    return new TweetNode(node.__id, node.__src, node.__format, node.__key)
  }

  static importJSON (serializedNode) {
    return $createTweetNode(serializedNode.id, serializedNode.src).updateFromJSON(serializedNode)
  }

  exportJSON () {
    return {
      ...super.exportJSON(),
      id: this.getId(),
      src: this.getSrc()
    }
  }

  static importDOM () {
    return {
      div: (domNode) => {
        if (!domNode.hasAttribute('data-lexical-tweet-id')) {
          return null
        }
        return {
          conversion: $convertTweetElement,
          priority: 2
        }
      }
    }
  }

  exportDOM () {
    return { element: placeholderNode({ provider: 'tweet', id: this.__id, src: this.__src }) }
  }

  createDOM (config) {
    const domNode = super.createDOM(config)
    domNode.className = config.theme.twitterContainer
    return domNode
  }

  constructor (id, src, format, key) {
    super(format, key)
    this.__id = id
    this.__src = src
  }

  getId () {
    return this.__id
  }

  getSrc () {
    return this.__src
  }

  getTextContent (_includeInert, _includeDirectionless) {
    return this.__src
  }

  updateDOM (prevNode, domNode) {
    const prevId = prevNode.getId()
    const id = this.getId()
    if (prevId !== id) {
      domNode.setAttribute('data-lexical-tweet-id', id)
    }
    const prevSrc = prevNode.getSrc()
    const src = this.getSrc()
    if (prevSrc !== src) {
      domNode.setAttribute('data-lexical-tweet-src', src)
    }
    return true
  }

  decorate (editor, config) {
    const className = config.theme.twitterEmbed || {}
    const topLevel = config.theme.topLevel || false
    const Embed = require('@/components/embed').default
    return (
      <Embed id={this.__id} provider='twitter' className={className} topLevel={topLevel} src={this.__src} />
    )
  }
}

export function $createTweetNode (id, src) {
  return new TweetNode(id, src)
}

export function $isTweetNode (node) {
  return node instanceof TweetNode
}
