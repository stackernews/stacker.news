import { $getState, $setState, createState } from 'lexical'
import { DecoratorBlockNode } from '@lexical/react/LexicalDecoratorBlockNode'
import { BlockWithAlignableContents } from '@lexical/react/LexicalBlockWithAlignableContents'
import { placeholderNode } from './placeholder'

export const createEmbedNodeClass = (provider) => {
  const idState = createState('id', {
    parse: (value) => (typeof value === 'string' ? value : '')
  })

  const srcState = createState('src', {
    parse: (value) => (typeof value === 'string' ? value : '')
  })

  const metaState = createState('meta', {
    parse: (value) => (typeof value === 'object' ? value : null)
  })

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
          id: this.getId() || '',
          src: this.getSrc(),
          meta: this.getMeta() || {}
        })
      }
    }

    getTextContent () {
      return this.getSrc() || this.getMeta()?.href
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
            provider={provider}
            id={this.getId() || ''}
            src={this.getSrc() || ''}
            meta={this.getMeta() || {}}
            className={config.theme?.embeds?.[provider]?.embed}
            topLevel={config.theme?.topLevel}
          />
        </BlockWithAlignableContents>
      )
    }
  }
}
