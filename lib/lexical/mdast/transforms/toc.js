import { findAndReplace } from 'mdast-util-find-and-replace'

export function tocTransform (tree) {
  findAndReplace(
    tree,
    [
      [
        /^\{:toc\}\s?$/,
        () => {
          return { type: 'tableOfContents' }
        }
      ]
    ])
}
