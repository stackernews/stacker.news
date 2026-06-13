/* eslint-env jest */

import { createHeadlessEditor } from '@lexical/headless'
import { $isItemMentionNode } from '@/lib/lexical/nodes/decorative/mentions/item'
import { ItemMentionNode, $createItemMentionNode } from '@/lib/lexical/nodes/decorative/mentions'
import { LexicalItemMentionVisitor, MdastItemMentionLinkVisitor } from './visitors/mentions.js'
import { IS_ITALIC } from './format-constants.js'

function createEditor () {
  return createHeadlessEditor({
    namespace: 'item-mention-format-test',
    nodes: [ItemMentionNode],
    onError: (error) => { throw error }
  })
}

describe('item mention markdown formatting', () => {
  test('imports italic formatting from an internal item link label', () => {
    process.env.NEXT_PUBLIC_URL = 'https://stacker.news'
    const editor = createEditor()
    let itemMention

    editor.update(() => {
      MdastItemMentionLinkVisitor.visitNode({
        mdastNode: {
          type: 'link',
          url: 'https://stacker.news/items/778491',
          children: [
            {
              type: 'emphasis',
              children: [{ type: 'text', value: 'High Risk, Low Reward' }]
            }
          ]
        },
        actions: {
          getParentFormatting: () => 0,
          addAndStepInto: (node) => {
            itemMention = {
              isItemMention: $isItemMentionNode(node),
              text: node.getText(),
              format: node.getFormat()
            }
          },
          nextVisitor: () => {}
        }
      })
    }, { discrete: true })

    expect(itemMention.isItemMention).toBe(true)
    expect(itemMention.text).toBe('High Risk, Low Reward')
    expect(itemMention.format & IS_ITALIC).toBe(IS_ITALIC)
  })

  test('exports formatted custom item mention text', () => {
    const editor = createEditor()
    let link

    editor.update(() => {
      const lexicalNode = $createItemMentionNode({
        id: '778491',
        text: 'High Risk, Low Reward',
        url: 'https://stacker.news/items/778491',
        format: IS_ITALIC
      })
      const mdastParent = { type: 'paragraph', children: [] }

      LexicalItemMentionVisitor.visitLexicalNode({
        lexicalNode,
        mdastParent,
        actions: {
          appendToParent: (parent, node) => {
            parent.children.push(node)
            return node
          }
        }
      })

      link = mdastParent.children[0]
    }, { discrete: true })

    expect(link).toEqual({
      type: 'link',
      url: 'https://stacker.news/items/778491',
      children: [
        {
          type: 'emphasis',
          children: [{ type: 'text', value: 'High Risk, Low Reward' }]
        }
      ]
    })
  })
})
