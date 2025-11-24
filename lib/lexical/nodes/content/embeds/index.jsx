import { DecoratorBlockNode } from '@lexical/react/LexicalDecoratorBlockNode'
import { BlockWithAlignableContents } from '@lexical/react/LexicalBlockWithAlignableContents'
import { placeholderNode } from './placeholder'

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

  const node = $createEmbedNode(provider, id, src, meta)
  return { node }
}

export class EmbedNode extends DecoratorBlockNode {
  __provider
  __id
  __src
  __meta

  $config () {
    return this.config('embed', {
      extends: DecoratorBlockNode,
      importDOM: {
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
            conversion: (domNode) => $convertEmbedElement(domNode),
            priority: 2
          }
        },
        div: (domNode) => {
          return this.importDOM().span(domNode)
        }
      }
    })
  }

  constructor (provider = null, src = null, id = null, meta = null, key) {
    super(key)
    this.__provider = provider
    this.__id = id
    this.__src = src
    this.__meta = meta
  }

  updateDOM (prevNode, domNode) {
    return false
  }

  exportDOM () {
    return {
      element: placeholderNode({
        provider: this.__provider || '',
        id: this.__id || '',
        src: this.__src || '',
        meta: this.__meta || {}
      })
    }
  }

  getTextContent () {
    return this.__src || this.__meta?.href
  }

  decorate (_editor, config) {
    const Embed = require('@/components/embed').default
    const embedBlockTheme = config.theme.embeds || {}
    const className = {
      base: embedBlockTheme.base || '',
      focus: embedBlockTheme.focus || ''
    }

    return (
      // this allows us to subject the embed blocks to formatting
      // and also select them, show text cursors, etc.
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
          topLevel={config.theme?.topLevel}
        />
      </BlockWithAlignableContents>
    )
  }
}

export function $createEmbedNode (provider = null, src = null, id = null, meta = null) {
  return new EmbedNode(provider, src, id, meta)
}

export function $isEmbedNode (node) {
  return node instanceof EmbedNode
}
