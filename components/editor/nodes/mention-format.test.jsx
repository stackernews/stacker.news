/* eslint-env jest */

import { renderToStaticMarkup } from 'react-dom/server'
import MentionFormat from './mention-format'
import { IS_BOLD, IS_ITALIC, IS_UNDERLINE } from '@/lib/lexical/mdast/format-constants'

describe('MentionFormat', () => {
  it('renders an italic internal-link label as emphasis', () => {
    expect(renderToStaticMarkup(
      <MentionFormat format={IS_ITALIC}>High Risk, Low Reward</MentionFormat>
    )).toBe('<em>High Risk, Low Reward</em>')
  })

  it('composes multiple text formats', () => {
    expect(renderToStaticMarkup(
      <MentionFormat format={IS_BOLD | IS_ITALIC | IS_UNDERLINE}>formatted</MentionFormat>
    )).toBe('<u><em><strong>formatted</strong></em></u>')
  })

  it('leaves an unformatted label unchanged', () => {
    expect(renderToStaticMarkup(
      <MentionFormat>plain</MentionFormat>
    )).toBe('plain')
  })
})
