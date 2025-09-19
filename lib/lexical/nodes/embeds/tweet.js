import { DecoratorBlockNode } from '@lexical/react/LexicalDecoratorBlockNode'
import { TwitterTweetEmbed } from 'react-twitter-embed'

function $convertTweetElement (domNode) {
  const id = domNode.getAttribute('data-lexical-tweet-id')
  if (!id) return null
  const node = $createTweetNode(id)
  return { node }
}

export class TweetNode extends DecoratorBlockNode {
  __id

  static getType () {
    return 'tweet'
  }

  static clone (node) {
    return new TweetNode(node.__id, node.__format, node.__key)
  }

  static importJSON (serializedNode) {
    return $createTweetNode(serializedNode.id).updateFromJSON(serializedNode)
  }

  exportJSON () {
    return {
      ...super.exportJSON(),
      id: this.getId()
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
    const element = document.createElement('div')
    element.setAttribute('data-lexical-tweet-id', this.__id)
    const text = document.createTextNode(this.getTextContent())
    element.append(text)
    return { element }
  }

  createDOM (config) {
    const domNode = super.createDOM(config)
    domNode.className = config.theme.twitterContainer
    return domNode
  }

  constructor (id, format, key) {
    super(format, key)
    this.__id = id
  }

  getId () {
    return this.__id
  }

  getTextContent (_includeInert, _includeDirectionless) {
    return `https://x.com/i/web/status/${this.__id}`
  }

  updateDOM (prevNode, domNode) {
    const prevId = prevNode.getId()
    const id = this.getId()
    if (prevId !== id) {
      domNode.setAttribute('data-lexical-tweet-id', id)
    }
    return true
  }

  decorate (editor, config) {
    const className = config.theme.twitter || {}
    console.log('decorate', this.__id)
    return (
      <div className={className}>
        <TwitterTweetEmbed tweetId={this.__id} className={className} options={{ theme: 'dark', width: '350px' }} />
      </div>
    )
  }
}

export function $createTweetNode (id) {
  return new TweetNode(id)
}

export function $isTweetNode (node) {
  return node instanceof TweetNode
}
