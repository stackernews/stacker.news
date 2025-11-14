import { $getState, $setState, createState } from 'lexical'
import { DecoratorBlockNode } from '@lexical/react/LexicalDecoratorBlockNode'
import { BlockWithAlignableContents } from '@lexical/react/LexicalBlockWithAlignableContents'
import placeholderNode from './placeholder'

const idState = createState('id', {
  parse: (value) => (typeof value === 'string' ? value : '')
})

const srcState = createState('src', {
  parse: (value) => (typeof value === 'string' ? value : '')
})

const metaState = createState('meta', {
  parse: (value) => (typeof value === 'object' ? value : null)
})

export const createEmbedNodeClass = (provider) => {
  return class extends DecoratorBlockNode {
    $config () {
      return this.config(provider, {
        extends: DecoratorBlockNode,
        stateConfigs: [
          { flat: true, stateConfig: idState },
          { flat: true, stateConfig: srcState },
          { flat: true, stateConfig: metaState }
        ]
      })
    }

    getId () {
      return $getState(this, idState)
    }

    setId (valueOrUpdater) {
      return $setState(this, idState, valueOrUpdater)
    }

    getSrc () {
      return $getState(this, srcState)
    }

    setSrc (valueOrUpdater) {
      return $setState(this, srcState, valueOrUpdater)
    }

    getMeta () {
      return $getState(this, metaState)
    }

    setMeta (valueOrUpdater) {
      return $setState(this, metaState, valueOrUpdater)
    }

    updateDOM (prevNode, domNode) {
      return false
    }

    exportDOM () {
      return {
        element: placeholderNode({
          provider,
          id: $getState(this, idState),
          src: $getState(this, srcState),
          meta: $getState(this, metaState)
        })
      }
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
            provider={provider}
            id={$getState(this, idState)}
            src={$getState(this, srcState)}
            meta={$getState(this, metaState)}
            className={config.theme?.embeds?.[provider]?.embed}
          />
        </BlockWithAlignableContents>
      )
    }
  }
}

export function $createEmbedNode (NodeClass, props) {
  const node = new NodeClass()
  if (props.id !== undefined) node.setId(props.id)
  if (props.src !== undefined) node.setSrc(props.src)
  if (props.meta !== undefined) node.setMeta(props.meta)
  return node
}

export function createNodeComparison (NodeClass, provider) {
  const capitalizedProvider = provider.charAt(0).toUpperCase() + provider.slice(1)
  return {
    [`$is${capitalizedProvider}Node`]: (node) => {
      return node instanceof NodeClass
    }
  }
}
