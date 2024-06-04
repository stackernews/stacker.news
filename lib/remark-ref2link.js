import { findAndReplace } from 'mdast-util-find-and-replace'

const refRegex = /#(\d+(\/(edit|related|ots))?)/gi

export default function ref (options) {
  return function transformer (tree) {
    findAndReplace(
      tree,
      [
        [refRegex, replaceRef]
      ],
      { ignore: ['link', 'linkReference'] }
    )
  }

  function replaceRef (value, itemId, match) {
    const node = { type: 'text', value }

    return {
      type: 'link',
      title: null,
      url: `/items/${itemId}`,
      children: [node]
    }
  }
}
