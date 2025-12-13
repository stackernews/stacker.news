import { UserMentionNode, $createUserMentionNode, $isUserMentionNode } from '@/lib/lexical/nodes/decorative/mentions/user'

/** user mentions transformer
 *
 *  rich mode: gets a user mention node and creates \@nym
 *
 *  markdown mode: from \@nym to user mention node
 *
 */
export const USER_MENTIONS = {
  dependencies: [UserMentionNode],
  export: (node) => {
    if (!$isUserMentionNode(node)) return null
    return '@' + node.getUserMentionName()
  },
  importRegExp: /\B@([\w_]+)/,
  regExp: /\B@([\w_]+)/,
  replace: (textNode, match) => {
    const mentionNode = $createUserMentionNode(null, match[1])
    textNode.replace(mentionNode)
  },
  trigger: '@',
  type: 'text-match'
}
