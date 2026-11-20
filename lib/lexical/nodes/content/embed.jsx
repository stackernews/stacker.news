import { DecoratorBlockNode } from '@lexical/react/LexicalDecoratorBlockNode'
import { BlockWithAlignableContents } from '@lexical/react/LexicalBlockWithAlignableContents'
import { $applyNodeReplacement, createState, $getState, $setState } from 'lexical'

// the embed data saved on the item. ItemContextExtension sets it after the node is created, so we keep it in a state
const dataState = createState('data', {
  parse: (value) => (typeof value === 'object' ? value : null)
})

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

/** writes embed fields as data attributes so the node can be losslessly
 * reconstructed from HTML into Lexical (see $convertEmbedElement) */
function setEmbedHydrationAttributes (node, el) {
  const id = node.getId()
  const src = node.getSrc()
  const meta = node.getMeta()
  el.setAttribute('data-lexical-embed-provider', node.getProvider() || '')
  if (id) el.setAttribute('data-lexical-embed-id', id)
  if (src) el.setAttribute('data-lexical-embed-src', src)
  if (meta) el.setAttribute('data-lexical-embed-meta', JSON.stringify(meta))
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
    return $createEmbedNode({ provider, src, id, meta }).updateFromJSON(serializedNode)
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

  exportDOM (editor) {
    const decorator = document.createElement('div')
    const wrapper = document.createElement('div')
    wrapper.className = 'sn-embed-wrapper'
    const container = document.createElement('div')

    // 1:1 styling with placeholder
    const placeholderClass = editor?._config?.theme?.embeds?.placeholder
    const providerClasses = editor?._config?.theme?.embeds?.[this.__provider]
    const classes = [
      placeholderClass,
      providerClasses?.container,
      providerClasses?.embed,
      providerClasses?.skeleton
    ]
    container.classList.add(...classes.filter(Boolean))

    // tweets and nostr links show a skeleton until the client draws the card
    if (providerClasses?.skeleton) {
      for (let i = 0; i < 3; i++) {
        const line = document.createElement('div')
        line.className = 'clouds'
        container.append(line)
      }
    }

    setEmbedHydrationAttributes(this, container)

    wrapper.append(container)
    decorator.append(wrapper)

    return { element: decorator }
  }

  createDOM (config) {
    const div = super.createDOM(config)
    setEmbedHydrationAttributes(this, div)
    return div
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

  getData () {
    return $getState(this, dataState)
  }

  setData (data) {
    $setState(this, dataState, data)
  }

  decorate (_editor, config) {
    const Embed = require('@/components/embed').default

    const className = {
      base: config.theme?.embeds?.base || '',
      focus: 'focused'
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
          data={this.getData()}
          className={config.theme?.embeds?.[this.__provider]?.embed}
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
