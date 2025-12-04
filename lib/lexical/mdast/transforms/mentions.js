import { findAndReplace } from 'mdast-util-find-and-replace'

// regexes from rehype-sn.js
const userGroup = '[\\w_]+'
const subGroup = '[A-Za-z][\\w_]+'

const USER_MENTION_PATTERN = new RegExp('\\B@(' + userGroup + '(?:\\/' + userGroup + ')?)', 'gi')
const TERRITORY_MENTION_PATTERN = new RegExp('~(' + subGroup + '(?:\\/' + subGroup + ')?)', 'gi')
const IGNORE_TYPES = ['code', 'inlineCode']

export function mentionTransform (tree) {
  findAndReplace(
    tree,
    [
      [
        USER_MENTION_PATTERN,
        (value) => {
          const [name, ...pathParts] = value.slice(1).split('/')
          return {
            type: 'userMention',
            value: {
              name,
              path: pathParts.length ? '/' + pathParts.join('/') : ''
            }
          }
        }
      ],
      [
        TERRITORY_MENTION_PATTERN,
        (value) => ({
          type: 'territoryMention',
          value: value.slice(1)
        })
      ]
    ],
    { ignore: IGNORE_TYPES }
  )
}
