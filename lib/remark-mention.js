import { findAndReplace } from 'mdast-util-find-and-replace'

const userGroup = '[\\w_]+'

const mentionRegex = new RegExp(
  '@(' + userGroup + '(?:\\/' + userGroup + ')?)',
  'gi'
)

export default function mention (options) {
  return function transformer (tree) {
    findAndReplace(
      tree,
      [
        [mentionRegex, replaceMention]
      ],
      { ignore: ['link', 'linkReference'] }
    )
  }

  function replaceMention (value, username, match) {
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
      url: '/' + username,
      children: [node]
    }
  }
}
