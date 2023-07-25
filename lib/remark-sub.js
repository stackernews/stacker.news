import { findAndReplace } from 'mdast-util-find-and-replace'

const subGroup = '[A-Za-z][\\w_]+'

const subRegex = new RegExp(
  '~(' + subGroup + '(?:\\/' + subGroup + ')?)',
  'gi'
)

export default function mention (options) {
  return function transformer (tree) {
    findAndReplace(
      tree,
      [
        [subRegex, replaceSub]
      ],
      { ignore: ['link', 'linkReference'] }
    )
  }

  function replaceSub (value, sub, match) {
    if (
      /[\w`]/.test(match.input.charAt(match.index - 1)) ||
      /[/\w`]/.test(match.input.charAt(match.index + value.length))
    ) {
      return false
    }

    const node = { type: 'text', value }

    return {
      type: 'link',
      title: null,
      url: '/~' + sub,
      children: [node]
    }
  }
}
