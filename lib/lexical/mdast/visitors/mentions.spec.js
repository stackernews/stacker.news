/* eslint-env jest */

import { MdastItemMentionLinkVisitor, hasOnlyPlainTextChildren } from './mentions.js'

describe('item mention links', () => {
  test('converts plain internal link text to item mentions', () => {
    expect(hasOnlyPlainTextChildren([
      { type: 'text', value: 'High Risk, Low Reward' }
    ])).toBe(true)
  })

  test('preserves formatted internal link text as regular links', () => {
    expect(hasOnlyPlainTextChildren([
      {
        type: 'emphasis',
        children: [{ type: 'text', value: 'High Risk, Low Reward' }]
      }
    ])).toBe(false)
  })

  test('falls through to the regular link visitor for formatted internal links', () => {
    process.env.NEXT_PUBLIC_URL = 'https://stacker.news'

    const actions = {
      nextVisitor: jest.fn(),
      addAndStepInto: jest.fn()
    }

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
      actions
    })

    expect(actions.nextVisitor).toHaveBeenCalledTimes(1)
    expect(actions.addAndStepInto).not.toHaveBeenCalled()
  })
})
