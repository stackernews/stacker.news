import { DecoratorBlockNode } from '@lexical/react/LexicalDecoratorBlockNode'
import { BlockWithAlignableContents } from '@lexical/react/LexicalBlockWithAlignableContents'
import { $applyNodeReplacement } from 'lexical'

export function $convertEmbedElement (domNode) {
  const provider = domNode.getAttribute('data-lexical-embed-provider')
  if (!provider) return null

  const id = domNode.getAttribute('data-lexical-embed-id')
  const src = domNode.getAttribute('data-lexical-embed-src')
  const metaString = domNode.getAttribute('data-lexical-embed-meta')
  let meta = null

  if (metaString) {
    try {
      meta = JSON.parse(metaString)
    } catch (e) {
      console.warn(`failed to parse ${provider} embed meta:`, e)
    }
  }

  const node = $createEmbedNode({ provider, src, id, meta })
  return { node }
}

export class EmbedNode extends DecoratorBlockNode {
  __provider
  __id
  __src
  __meta

  static getType () {
    return 'embed'
  }

  static clone (node) {
    return new EmbedNode(
      node.__provider,
      node.__src,
      node.__id,
      node.__meta,
      node.__format,
      node.__key
    )
  }

  static importJSON (serializedNode) {
    const { provider, src, id, meta } = serializedNode
    return $createEmbedNode({ provider, src, id, meta })
  }

  static importDOM () {
    return {
      span: (domNode) => {
        const provider = domNode.getAttribute('data-lexical-embed-provider')
        if (!provider) return null

        const hasEmbedId = domNode.hasAttribute('data-lexical-embed-id')
        const hasEmbedSrc = domNode.hasAttribute('data-lexical-embed-src')
        const hasEmbedMeta = domNode.hasAttribute('data-lexical-embed-meta')

        if (!hasEmbedId && !hasEmbedSrc && !hasEmbedMeta) {
          return null
        }

        return {
          conversion: $convertEmbedElement,
          priority: 2
        }
      },
      div: (domNode) => {
        return EmbedNode.importDOM().span(domNode)
      }
    }
  }

  constructor (provider = null, src = null, id = null, meta = null, format, key) {
    super(format, key)
    this.__provider = provider
    this.__src = src
    this.__id = id
    this.__meta = meta
  }

  exportJSON () {
    return {
      ...super.exportJSON(),
      provider: this.__provider,
      src: this.__src,
      id: this.__id,
      meta: this.__meta
    }
  }

  exportDOM () {
    const container = document.createElement('span')
    container.className = 'sn-embed-placeholder'
    container.setAttribute('data-lexical-embed-provider', this.__provider || '')
    this.__id && container.setAttribute('data-lexical-embed-id', this.__id)
    this.__src && container.setAttribute('data-lexical-embed-src', this.__src)
    this.__meta && container.setAttribute('data-lexical-embed-meta', JSON.stringify(this.__meta))

    if (this.__src) {
      const link = document.createElement('a')
      link.href = this.__src
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      try {
        link.textContent = 'view on ' + new URL(this.__src).hostname
      } catch {
        link.textContent = 'view on ' + this.__provider
      }
      container.append(link)
    }

    return { element: container }
  }

  updateDOM () {
    return false
  }

  getTextContent () {
    return this.__src || this.__meta?.href
  }

  getProvider () {
    return this.__provider
  }

  getSrc () {
    return this.__src
  }

  getId () {
    return this.__id
  }

  getMeta () {
    return this.__meta
  }

  decorate (_editor, config) {
    const Embed = require('@/components/embed').default
    const embedBlockTheme = config.theme.embeds || {}
    const className = {
      base: embedBlockTheme.base || '',
      focus: embedBlockTheme.focus || ''
    }

    return (
      <BlockWithAlignableContents
        nodeKey={this.getKey()}
        className={className}
        format={this.__format}
      >
        <Embed
          provider={this.__provider || ''}
          id={this.__id || ''}
          src={this.__src || ''}
          meta={this.__meta || {}}
          className={config.theme?.embeds?.[this.__provider]?.embed}
          topLevel={!!config.theme?.topLevel}
        />
      </BlockWithAlignableContents>
    )
  }
}

export function $createEmbedNode ({ provider, src, id, meta }) {
  return $applyNodeReplacement(new EmbedNode(provider, src, id, meta))
}

export function $isEmbedNode (node) {
  return node instanceof EmbedNode
}
