/* eslint-env jest */

import { normalizeLexicalHTML } from './normalize-html.js'

describe('normalizeLexicalHTML', () => {
  test('removes Lexical default table cell styles from SSR HTML', () => {
    const html = [
      '<table class="sn-table">',
      '<tr>',
      '<th class="sn-table__cell sn-table__cell--header" style="border: 1px solid black; width: 75px; vertical-align: top; text-align: start; background-color: rgb(242, 243, 245);">heading</th>',
      '<td class="sn-table__cell" style="border: 1px solid black; width: 75px; vertical-align: top; text-align: start;">cell</td>',
      '</tr>',
      '</table>'
    ].join('')

    expect(normalizeLexicalHTML(html)).toBe([
      '<table class="sn-table">',
      '<tr>',
      '<th class="sn-table__cell sn-table__cell--header">heading</th>',
      '<td class="sn-table__cell">cell</td>',
      '</tr>',
      '</table>'
    ].join(''))
  })

  test('keeps explicit non-default cell widths', () => {
    const html = '<td class="sn-table__cell" style="border: 1px solid black; width: 180px; vertical-align: top; text-align: start;">cell</td>'

    expect(normalizeLexicalHTML(html)).toBe('<td class="sn-table__cell" style="width:180px">cell</td>')
  })

  test('does not alter non-Lexical table cells', () => {
    const html = '<td style="border: 1px solid black; width: 75px;">cell</td>'

    expect(normalizeLexicalHTML(html)).toBe(html)
  })
})
