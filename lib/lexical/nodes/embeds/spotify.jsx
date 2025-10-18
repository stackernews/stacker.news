import { DecoratorBlockNode } from '@lexical/react/LexicalDecoratorBlockNode'
import { placeholderNode } from './placeholder'

function $convertSpotifyElement (domNode) {
  const src = domNode.getAttribute('data-lexical-embed-src')
  if (!src) return null
  const node = $createSpotifyNode(src)
  return { node }
}

export class SpotifyNode extends DecoratorBlockNode {
  __src

  static getType () {
    return 'spotify'
  }

  static clone (node) {
    return new SpotifyNode(node.__src, node.__format, node.__key)
  }

  static importJSON (serializedNode) {
    return $createSpotifyNode(serializedNode.src).updateFromJSON(serializedNode)
  }

  exportJSON () {
    return {
      ...super.exportJSON(),
      src: this.getSrc()
    }
  }

  static importDOM () {
    return {
      div: (domNode) => {
        if (!domNode.hasAttribute('data-lexical-embed-src')) {
          return null
        }
        return {
          conversion: $convertSpotifyElement,
          priority: 2
        }
      }
    }
  }

  exportDOM () {
    return { element: placeholderNode({ provider: 'spotify', src: this.__src }) }
  }

  createDOM (config) {
    const domNode = super.createDOM(config)
    domNode.className = config.theme.spotifyContainer
    return domNode
  }

  constructor (src, format, key) {
    super(format, key)
    this.__src = src
  }

  getSrc () {
    return this.__src
  }

  getTextContent (_includeInert, _includeDirectionless) {
    return this.__src
  }

  updateDOM (prevNode, domNode) {
    const prevSrc = prevNode.getSrc()
    const src = this.getSrc()
    if (prevSrc !== src) {
      domNode.setAttribute('data-lexical-embed-src', src)
    }
    return true
  }

  decorate (editor, config) {
    const className = config.theme.spotifyEmbed || {}
    const Embed = require('@/components/embed').default
    return (
      <Embed src={this.__src} provider='spotify' className={className} />
    )
  }
}

export function $createSpotifyNode (src) {
  return new SpotifyNode(src)
}

export function $isSpotifyNode (node) {
  return node instanceof SpotifyNode
}
